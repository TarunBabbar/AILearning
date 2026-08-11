import { callOpenRouter, extractJsonArray } from "@/lib/openrouter";
import { prisma } from "@/lib/db";
import { listFreeOpenRouterModelIds } from "@/lib/free-models";
import { getConfig } from "@/lib/config";
import { createLogger } from "@/lib/logger";
import { nonGenericEmailWhere } from "@/lib/company";
import type { Prisma } from "@prisma-generated/client";

/** Jobs per LLM request. */
export const SCORE_JOBS_PER_MODEL = 10;

const RESUME_CHARS = 8000;
const DESC_CHARS = 400;

export type ScoreJobInput = {
  id: string;
  title: string;
  company: string;
  description: string | null;
  jobDate?: Date | null;
  createdAt?: Date | null;
};

export type ScoreResult = {
  jobId: string;
  score: number;
  strengths: string | null;
  gaps: string | null;
};

function buildBatchPrompt(resumeText: string, batch: ScoreJobInput[]): string {
  const jobsBlock = batch
    .map(
      (j, i) =>
        `[${i}] Title: ${j.title}\nCompany: ${j.company}\nDescription: ${(j.description || "").slice(0, DESC_CHARS)}`
    )
    .join("\n\n");

  return `You are a resume-job matcher. Score how well the resume matches each job from 0-100.

For each job evaluate: skills overlap, experience alignment, domain relevance, and seniority fit.
Keep "strengths" and "gaps" to ONE concise sentence each.

Resume:
${resumeText.slice(0, RESUME_CHARS)}

Jobs:
${jobsBlock}

Respond with ONLY a valid JSON array — no markdown:
[{"idx":0,"score":85,"strengths":"...","gaps":"..."}]`;
}

function parseScores(
  content: string,
  batch: ScoreJobInput[]
): ScoreResult[] {
  const parsed = extractJsonArray<{
    idx?: number;
    score?: number;
    strengths?: string;
    gaps?: string;
  }>(content);
  if (!parsed?.length) return [];

  const results: ScoreResult[] = [];
  const seen = new Set<number>();
  for (const e of parsed) {
    let localIdx = Number(e.idx);
    if (!Number.isFinite(localIdx)) continue;
    // Accept 0-based; if model used 1-based and 0 is unused, shift down
    if (
      localIdx >= 1 &&
      localIdx <= batch.length &&
      !parsed.some((p) => Number(p.idx) === 0)
    ) {
      localIdx = localIdx - 1;
    }
    if (localIdx < 0 || localIdx >= batch.length || seen.has(localIdx)) continue;
    seen.add(localIdx);
    const job = batch[localIdx];
    results.push({
      jobId: job.id,
      score: Math.max(0, Math.min(100, Math.round(Number(e.score) || 0))),
      strengths: e.strengths ? String(e.strengths).slice(0, 500) : null,
      gaps: e.gaps ? String(e.gaps).slice(0, 500) : null,
    });
  }
  return results;
}

function chunkJobs<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function upsertJobScores(
  userId: string,
  scores: ScoreResult[]
): Promise<number> {
  let n = 0;
  await Promise.all(
    scores.map(async (s) => {
      await prisma.jobScore.upsert({
        where: { userId_jobId: { userId, jobId: s.jobId } },
        create: {
          userId,
          jobId: s.jobId,
          score: s.score,
          strengths: s.strengths,
          gaps: s.gaps,
        },
        update: {
          score: s.score,
          strengths: s.strengths,
          gaps: s.gaps,
          scoredAt: new Date(),
        },
      });
      n++;
    })
  );
  return scores.length;
}

/**
 * Score one chunk with a model. Single attempt — fail fast. Retrying the same
 * chunk on the same model rarely helps (empty responses don't become valid on
 * retry) and stalls the whole wave. Failures are collected and returned to the
 * caller; the wave moves on immediately.
 */
async function scoreChunkWithModel(
  resumeText: string,
  batch: ScoreJobInput[],
  apiKey: string,
  model: string
): Promise<ScoreResult[]> {
  const content = await callOpenRouter(
    buildBatchPrompt(resumeText, batch),
    "You are a precise resume-job matching AI. Respond with ONLY valid JSON.",
    apiKey,
    {
      model,
      maxTokens: 4096,
      temperature: 0.2,
      // One shot per chunk — keep it short so a flaky free model can't
      // pin a worker for minutes. maxRetries: 1 = exactly one attempt
      // (callOpenRouter's loop runs `attempt <= maxRetries`).
      timeoutMs: 60_000,
      maxRetries: 1,
    }
  );
  const results = parseScores(content, batch);
  if (!results.length) {
    throw new Error("Empty or unparseable score JSON");
  }
  return results;
}

export type ParallelScoreResult = {
  scored: number;
  attempted: number;
  modelsUsed: string[];
  failedModels: string[];
  modelCount: number;
};

export type ScoreChunkProgress = {
  scoredDelta: number;
  scoredInWave: number;
  model: string;
};

/**
 * Fan-out scoring as a work pool:
 *  - Jobs are chunked into batches of SCORE_JOBS_PER_MODEL.
 *  - Every free model becomes a worker that drains chunks off a shared queue.
 *  - Chunks are distributed round-robin so each model gets an equal share
 *    (~jobs / #models), then the queue keeps workers busy as chunks finish.
 *  - No retries: a failed chunk is dropped from this wave and reported via
 *    failedCount. It stays unscored in the DB, so the next Score run picks it up.
 *
 * persistMode "unscored" (default) uses createMany+skipDuplicates — one round trip per
 * chunk — and is only safe when the caller guarantees jobs aren't already scored.
 * "all" keeps per-job upserts so existing scores can be updated.
 */
export async function scoreJobsParallel(
  resumeText: string,
  jobs: ScoreJobInput[],
  apiKey: string,
  userId: string,
  onProgress?: (info: ScoreChunkProgress) => void | Promise<void>,
  persistMode: "unscored" | "all" = "unscored"
): Promise<ParallelScoreResult> {
  const log = createLogger();
  if (!jobs.length) {
    return {
      scored: 0,
      attempted: 0,
      modelsUsed: [],
      failedModels: [],
      modelCount: 0,
    };
  }

  let models = await listFreeOpenRouterModelIds().catch(() => [] as string[]);
  if (!models.length) {
    const fallback = getConfig().llmModel;
    models = fallback ? [fallback] : [];
  }
  if (!models.length) {
    throw new Error("No free OpenRouter models available.");
  }

  const used = new Set<string>();
  const failedModels = new Set<string>();

  const chunks = chunkJobs(jobs, SCORE_JOBS_PER_MODEL);
  log.info(
    "score",
    `Work pool: ${chunks.length} chunk(s) × ≤${SCORE_JOBS_PER_MODEL} jobs across ${models.length} model(s)`
  );

  // Classic shared work queue: one counter, every worker pulls the next
  // chunk the moment it's free. `nextChunk++` is atomic in JS (no await
  // between read/write), so no chunk is ever handed to two workers.
  let nextChunk = 0;

  let scored = 0;

  async function persist(results: ScoreResult[], model: string): Promise<void> {
    if (persistMode === "all") {
      // Re-score: update existing rows
      for (const s of results) {
        await prisma.jobScore.upsert({
          where: { userId_jobId: { userId, jobId: s.jobId } },
          create: {
            userId,
            jobId: s.jobId,
            score: s.score,
            strengths: s.strengths,
            gaps: s.gaps,
          },
          update: {
            score: s.score,
            strengths: s.strengths,
            gaps: s.gaps,
            scoredAt: new Date(),
          },
        });
      }
    } else {
      // Fresh scores — one batched round trip per chunk
      await prisma.jobScore.createMany({
        data: results.map((s) => ({
          userId,
          jobId: s.jobId,
          score: s.score,
          strengths: s.strengths,
          gaps: s.gaps,
        })),
        skipDuplicates: true,
      });
    }
  }

  async function worker(model: string): Promise<void> {
    while (true) {
      const idx = nextChunk++;
      if (idx >= chunks.length) break;
      const chunk = chunks[idx];
      try {
        const results = await scoreChunkWithModel(resumeText, chunk, apiKey, model);
        used.add(model);
        await persist(results, model);
        scored += results.length;
        await onProgress?.({
          scoredDelta: results.length,
          scoredInWave: scored,
          model,
        });
        log.info(
          "score",
          `Chunk OK via ${model.replace(":free", "")}`,
          `${results.length} job(s)`
        );
      } catch (e) {
        failedModels.add(model);
        const msg = e instanceof Error ? e.message : String(e);
        log.warn(
          "score",
          `Chunk failed via ${model.replace(":free", "")} — dropping, ${chunk.length} job(s) left for next run`,
          msg.slice(0, 160)
        );
      }
    }
  }

  await Promise.all(models.map((m) => worker(m)));

  return {
    scored,
    attempted: chunks.reduce((n, c) => n + c.length, 0),
    modelsUsed: [...used],
    failedModels: [...failedModels],
    modelCount: models.length,
  };
}

/** How many jobs one parallel wave can cover. */
export async function parallelWaveCapacity(): Promise<number> {
  try {
    const models = await listFreeOpenRouterModelIds();
    const n = models.length || 1;
    return n * SCORE_JOBS_PER_MODEL;
  } catch {
    return SCORE_JOBS_PER_MODEL;
  }
}

/** Build Prisma where for shared jobs + optional search.
 * Always scoped to the QA Jobs universe (recruiter emails only) so the
 * Match by Resume counts match the dashboard's job count. */
export function jobsSearchWhere(search: string): Prisma.JobWhereInput {
  const q = search.trim();
  const searchWhere: Prisma.JobWhereInput = q
    ? {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { company: { contains: q, mode: "insensitive" } },
          { location: { contains: q, mode: "insensitive" } },
          { experience: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};
  return { AND: [searchWhere, nonGenericEmailWhere()] };
}

const RESUME_STOPWORDS = new Set(
  (
    "a an and are as at be but by for from had has have if in is it its may my of on or our that the this to was we were will with you your " +
    "i me he she they them resume cv skills experience job role position work company apply candidate qualification summary profile " +
    "responsible duties responsibilities ability able using use used including include"
  ).split(" ")
);

/** Lightweight lexical ranking: score each job by resume token overlap. */
export function rankJobsByResumeRelevance(
  resumeText: string,
  jobs: ScoreJobInput[]
): ScoreJobInput[] {
  const tokenize = (text: string): string[] =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9+#.\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !RESUME_STOPWORDS.has(t));

  const resumeTokens = tokenize(resumeText);
  if (!resumeTokens.length) return jobs;

  const freq = new Map<string, number>();
  for (const t of resumeTokens) freq.set(t, (freq.get(t) ?? 0) + 1);
  const weight = (t: string) => freq.get(t) ?? 0;

  const scored = jobs.map((j) => {
    const titleTokens = tokenize(j.title);
    const descTokens = tokenize(j.description || "");
    let relevance = 0;
    for (const t of titleTokens) relevance += weight(t) * 3;
    for (const t of tokenize(j.company)) relevance += weight(t);
    for (const t of descTokens) relevance += weight(t);
    return { job: j, relevance };
  });

  return scored
    .sort(
      (a, b) =>
        b.relevance - a.relevance ||
        (b.job.jobDate?.getTime() ?? 0) - (a.job.jobDate?.getTime() ?? 0) ||
        (b.job.createdAt?.getTime() ?? 0) - (a.job.createdAt?.getTime() ?? 0)
    )
    .map((s) => s.job);
}
