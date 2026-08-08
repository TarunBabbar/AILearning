import { prisma } from "@/lib/db";
import {
  getEmailDomain,
  isGenericDomain,
  resolveCompanyDetails,
  titleCase,
} from "@/lib/company";
import { createLogger, ms } from "@/lib/logger";

export type ResolveCompaniesResult = {
  resolved: number;
  created: number;
  total: number;
  /** Domains still waiting after this run (0 = finished). */
  remaining: number;
  /** How many domains were attempted in this run. */
  attempted: number;
};

const LLM_BATCH = 25;
/** Pause between LLM batches to ease free-model rate limits. */
const BATCH_PAUSE_MS = 5_000;

/**
 * Resolve + persist company details for email domains found on jobs.
 *
 * Processes domains in small LLM batches and **saves after each batch**, so a
 * mid-run 429 / crash keeps earlier progress. On Vercel pass `limit` (e.g. 10);
 * the local script uses `limit=0` (all remaining).
 */
export async function resolveAndStoreCompanyDetails(
  apiKey: string,
  model: string,
  limit = 0
): Promise<ResolveCompaniesResult> {
  const log = createLogger();

  const jobs = await prisma.job.findMany({
    where: {
      email: { not: null },
      OR: [
        { companyInfo: { is: null } },
        { companyInfo: { description: null } },
      ],
    },
    select: { id: true, email: true },
  });

  const domainSet = new Set<string>();
  for (const j of jobs) {
    const domain = getEmailDomain(j.email);
    if (domain && !isGenericDomain(domain)) {
      domainSet.add(domain);
    }
  }

  const allDomains = [...domainSet];
  if (!allDomains.length) {
    return {
      resolved: 0,
      created: 0,
      total: await prisma.company.count(),
      remaining: 0,
      attempted: 0,
    };
  }

  const domains =
    limit > 0 ? allDomains.slice(0, limit) : allDomains;

  let companiesCreated = 0;
  let resolvedCount = 0;

  for (let i = 0; i < domains.length; i += LLM_BATCH) {
    const batch = domains.slice(i, i + LLM_BATCH);
    const batchNo = Math.floor(i / LLM_BATCH) + 1;
    const batchTotal = Math.ceil(domains.length / LLM_BATCH);
    log.info(
      "resolve",
      `Batch ${batchNo}/${batchTotal} · ${batch.length} domain(s)`,
      batch.join(", ")
    );

    const resolved = await resolveCompanyDetails(batch, apiKey, model);

    for (const entry of resolved) {
      const name =
        entry.company && entry.company !== "Unknown"
          ? entry.company
          : titleCase(entry.domain.split(".")[0] || entry.domain);

      const existing = await prisma.company.findUnique({
        where: { domain: entry.domain },
      });

      let company;
      if (existing) {
        company = await prisma.company.update({
          where: { id: existing.id },
          data: {
            ...(existing.type ? {} : { type: entry.type }),
            ...(existing.description ? {} : { description: entry.description }),
            ...(existing.location ? {} : { location: entry.location }),
            ...(existing.website ? {} : { website: entry.website }),
          },
        });
      } else {
        company = await prisma.company.create({
          data: {
            domain: entry.domain,
            name,
            type: entry.type,
            description: entry.description,
            location: entry.location,
            website: entry.website,
            source: "llm",
          },
        });
        companiesCreated++;
      }

      await prisma.job.updateMany({
        where: {
          email: { endsWith: `@${entry.domain}`, mode: "insensitive" },
        },
        data: { companyId: company.id },
      });
      resolvedCount++;
    }

    // Cool down before next batch (skip after last).
    if (i + LLM_BATCH < domains.length) {
      log.info("resolve", `Pausing ${ms(BATCH_PAUSE_MS)} before next batch…`);
      await new Promise((r) => setTimeout(r, BATCH_PAUSE_MS));
    }
  }

  const stillJobs = await prisma.job.findMany({
    where: {
      email: { not: null },
      OR: [
        { companyInfo: { is: null } },
        { companyInfo: { description: null } },
      ],
    },
    select: { email: true },
  });
  const still = new Set<string>();
  for (const j of stillJobs) {
    const domain = getEmailDomain(j.email);
    if (domain && !isGenericDomain(domain)) still.add(domain);
  }

  return {
    resolved: resolvedCount,
    created: companiesCreated,
    total: await prisma.company.count(),
    remaining: still.size,
    attempted: domains.length,
  };
}
