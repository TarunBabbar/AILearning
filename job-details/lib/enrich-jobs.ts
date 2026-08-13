import { prisma } from "@/lib/db";
import { callOpenRouter, extractJsonObject } from "@/lib/openrouter";
import { resolveApiKey } from "@/lib/auth";
import { stripSpamText } from "@/lib/sanitize";
import { createLogger, type Logger } from "@/lib/logger";
import type { Prisma } from "@prisma-generated/client";

export type EnrichJobsResult = {
  scanned: number;
  missing: number;
  enriched: number;
  failed: number;
  skipped: number;
  remaining: number;
};

const BATCH_SIZE = 10;
/** Pause between LLM calls to ease free-model rate limits. */
const LLM_PAUSE_MS = 1_500;

/** Fields we can try to fill for a job that's missing data. */
export type EnrichableFields = "description" | "location" | "experience" | "email";

const ENRICH_SYSTEM_PROMPT =
  "You are a precise job data extractor. Given a job with some fields missing, fill in the MISSING fields from the available context. Respond with ONLY valid JSON. No markdown, no code fences, no explanation.";

function buildEnrichPrompt(
  job: {
    title: string;
    company: string;
    email: string | null;
    location: string | null;
    experience: string | null;
    description: string | null;
  },
  missing: EnrichableFields[]
): string {
  return `Complete this job's missing fields. Only include fields that are currently MISSING. Use the existing values as context — do not contradict them. If a missing field genuinely can't be determined, use an empty string "".

Job:
- Company: ${job.company || "Unknown"}
- Title: ${job.title || "Unknown Position"}
- Email: ${job.email || "(missing)"}
- Location: ${job.location || "(missing)"}
- Experience: ${job.experience || "(missing)"}
- Description: ${job.description ? job.description.slice(0, 200) : "(missing)"}

Missing fields to fill: ${missing.join(", ")}

Respond with ONLY JSON, e.g. ${JSON.stringify(
    Object.fromEntries(missing.map((f) => [f, ""]))
  )}`;
}

/**
 * Background enrichment: find jobs missing any of description / location /
 * experience / email and re-run the LLM to fill them, then update the DB.
 *
 * Returns stats for the run. Bounded by `limit` for serverless timeouts;
 * repeat runs pick up where the last one left off.
 */
export async function enrichIncompleteJobs(
  limit = 25
): Promise<EnrichJobsResult> {
  const log: Logger = createLogger();
  const { apiKey } = resolveApiKey();
  if (!apiKey) {
    log.error("enrich", "No OpenRouter API key configured", "aborting");
    throw new Error("No OpenRouter API key configured");
  }

  // Jobs missing at least one enrichable field.
  const MISSING_WHERE: Prisma.JobWhereInput = {
    OR: [
      { description: null },
      { description: "" },
      { location: null },
      { location: "" },
      { experience: null },
      { experience: "" },
      { email: null },
      { email: "" },
    ],
  };

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // Count the TOTAL pool of incomplete jobs. If it's small (≤30) we enrich
  // all of them. If it's large (hundreds), restrict to TODAY's new jobs so a
  // cron run doesn't burn LLM quota on the whole backlog — today's additions
  // get enriched first, and older gaps get picked up gradually over days.
  const totalIncomplete = await prisma.job.count({ where: MISSING_WHERE });
  const scopeToday = totalIncomplete > 30;

  const where = scopeToday
    ? { AND: [MISSING_WHERE, { createdAt: { gte: startOfToday } }] }
    : MISSING_WHERE;

  const incomplete = await prisma.job.findMany({
    where,
    select: {
      id: true,
      title: true,
      company: true,
      email: true,
      location: true,
      experience: true,
      description: true,
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  const result: EnrichJobsResult = {
    scanned: incomplete.length,
    missing: totalIncomplete,
    enriched: 0,
    failed: 0,
    skipped: 0,
    remaining: 0,
  };

  if (incomplete.length === 0) {
    log.info(
      "enrich",
      "No jobs with missing fields in scope",
      scopeToday
        ? `(${totalIncomplete} incomplete total — restricting to today's ${incomplete.length} new jobs)`
        : "done"
    );
    return result;
  }

  log.info(
    "enrich",
    `Found ${incomplete.length} job(s) with missing fields`,
    scopeToday
      ? `scope=TODAY (${totalIncomplete} incomplete total) — enriching today's new jobs`
      : `scope=ALL (${totalIncomplete} incomplete total — small backlog)`
  );

  for (let i = 0; i < incomplete.length; i += BATCH_SIZE) {
    const batch = incomplete.slice(i, i + BATCH_SIZE);

    for (const job of batch) {
      // Determine which fields are actually missing for this job.
      const missing: EnrichableFields[] = [];
      if (!job.description?.trim()) missing.push("description");
      if (!job.location?.trim()) missing.push("location");
      if (!job.experience?.trim()) missing.push("experience");
      if (!job.email?.trim()) missing.push("email");
      if (missing.length === 0) {
        result.skipped += 1;
        continue;
      }

      try {
        const prompt = buildEnrichPrompt(job, missing);
        const content = await callOpenRouter(
          prompt,
          ENRICH_SYSTEM_PROMPT,
          apiKey,
          { maxTokens: 1200, temperature: 0.4, maxRetries: 2 },
          log
        );
        const parsed = extractJsonObject<Record<string, string>>(content);
        if (!parsed) {
          result.skipped += 1;
          log.warn("enrich", `Job ${job.id} returned no usable JSON`, "skipped");
          continue;
        }

        const data: {
          description?: string;
          location?: string | null;
          experience?: string | null;
          email?: string | null;
        } = {};

        if (missing.includes("description")) {
          const d = (parsed.description || "").trim();
          if (d.length >= 40) data.description = stripSpamText(d);
        }
        if (missing.includes("location")) {
          const loc = (parsed.location || "").trim();
          if (loc && loc.toLowerCase() !== "unknown")
            data.location = loc;
        }
        if (missing.includes("experience")) {
          const exp = (parsed.experience || "").trim();
          if (exp && exp.toLowerCase() !== "unknown") data.experience = exp;
        }
        if (missing.includes("email")) {
          const em = (parsed.email || "").trim();
          if (em && em.includes("@")) data.email = em;
        }

        if (Object.keys(data).length === 0) {
          result.skipped += 1;
          log.warn("enrich", `Job ${job.id} returned nothing usable`, "skipped");
          continue;
        }

        await prisma.job.update({ where: { id: job.id }, data });
        result.enriched += 1;
        log.info(
          "enrich",
          `Enriched job ${job.id}`,
          `filled: ${Object.keys(data).join(", ")}`
        );
      } catch (e) {
        result.failed += 1;
        log.warn(
          "enrich",
          `Job ${job.id} failed`,
          e instanceof Error ? e.message : "LLM call failed"
        );
      }

      if (batch.length > 1) await new Promise((r) => setTimeout(r, LLM_PAUSE_MS));
    }
  }

  result.remaining = await prisma.job.count({ where });

  log.info(
    "enrich",
    "Enrichment run finished",
    `${result.enriched} enriched, ${result.failed} failed, ${result.skipped} skipped, ${result.remaining} remaining`
  );

  return result;
}
