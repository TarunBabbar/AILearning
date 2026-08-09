import { callOpenRouter, extractJsonArray, OpenRouterError } from "@/lib/openrouter";
import { prisma } from "@/lib/db";
import { listFreeOpenRouterModelIds } from "@/lib/free-models";
import { getConfig } from "@/lib/config";
import { createLogger } from "@/lib/logger";
import type { Prisma } from "@prisma-generated/client";

/** Jobs per LLM request. */
export const SCORE_JOBS_PER_MODEL = 10;
/** Retries per model before blacklisting it for this run. */
const MODEL_MAX_TRIES = 2;

const RESUME_CHARS = 8000;
const DESC_CHARS = 400;

export type ScoreJobInput = {
  id: string;
  title: string;
  company: string;
  description: string | null;
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
 * Score one chunk with a model; retry up to MODEL_MAX_TRIES, then throw.
 */
async function scoreChunkWithModel(
  resumeText: string,
  batch: ScoreJobInput[],
  apiKey: string,
  model: string
): Promise<ScoreResult[]> {
  let lastErr: Error | null = null;
  for (let tryNo = 1; tryNo <= MODEL_MAX_TRIES; tryNo++) {
    try {
      const content = await callOpenRouter(
        buildBatchPrompt(resumeText, batch),
        "You are a precise resume-job matching AI. Respond with ONLY valid JSON.",
        apiKey,
        { model, maxTokens: 4096, temperature: 0.2 }
      );
      const results = parseScores(content, batch);
      if (!results.length) {
        throw new Error("Empty or unparseable score JSON");
      }
      return results;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      // Auth/payment — don't burn retries on same model
      if (e instanceof OpenRouterError && (e.status === 401 || e.status === 402)) {
        throw e;
      }
    }
  }
  throw lastErr ?? new Error(`Model ${model} failed`);
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
 * Fan-out scoring: one free model per chunk of SCORE_JOBS_PER_MODEL jobs, all in parallel.
 * Persist each chunk to DB as soon as it succeeds; optional onProgress fires after each save.
 * After 2 failures, blacklist model and reassign chunk to another working model.
 */
export async function scoreJobsParallel(
  resumeText: string,
  jobs: ScoreJobInput[],
  apiKey: string,
  userId: string,
  onProgress?: (info: ScoreChunkProgress) => void | Promise<void>
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

  const dead = new Set<string>();
  const used = new Set<string>();
  // One chunk per free model this wave (N models → N parallel requests)
  const waveJobs = jobs.slice(0, models.length * SCORE_JOBS_PER_MODEL);
  const chunks = chunkJobs(waveJobs, SCORE_JOBS_PER_MODEL).slice(
    0,
    models.length
  );

  log.info(
    "score",
    `Parallel wave: ${chunks.length} chunk(s) × ≤${SCORE_JOBS_PER_MODEL} jobs · ${models.length} free model(s)`
  );

  // Distinct model per chunk for the first attempt
  const assignment = chunks.map((chunk, i) => ({
    chunk,
    model: models[i],
  }));

  function pickWorkingModel(exclude: Set<string>): string | null {
    return models.find((m) => !dead.has(m) && !exclude.has(m)) ?? null;
  }

  let scored = 0;

  await Promise.all(
    assignment.map(async ({ chunk, model: startModel }) => {
      let model: string | null = startModel;
      const triedForChunk = new Set<string>();

      while (model) {
        if (dead.has(model)) {
          model = pickWorkingModel(triedForChunk);
          continue;
        }
        triedForChunk.add(model);
        try {
          const results = await scoreChunkWithModel(
            resumeText,
            chunk,
            apiKey,
            model
          );
          used.add(model);
          // Persist + report one job at a time so UI % moves as soon as each score lands
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
            scored += 1;
            await onProgress?.({
              scoredDelta: 1,
              scoredInWave: scored,
              model,
            });
          }
          log.info(
            "score",
            `Chunk OK via ${model.replace(":free", "")}`,
            `${results.length} job(s)`
          );
          return;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          log.warn(
            "score",
            `Model ${model.replace(":free", "")} failed after ${MODEL_MAX_TRIES} tries — blacklisting`,
            msg.slice(0, 160)
          );
          dead.add(model);
          model = pickWorkingModel(triedForChunk);
        }
      }

      log.error(
        "score",
        "Chunk abandoned — no working models left",
        `${chunk.length} job(s) unscored this wave`
      );
    })
  );

  return {
    scored,
    attempted: waveJobs.length,
    modelsUsed: [...used],
    failedModels: [...dead],
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

/** Build Prisma where for shared jobs + optional search. */
export function jobsSearchWhere(search: string): Prisma.JobWhereInput {
  const q = search.trim();
  if (!q) return {};
  return {
    OR: [
      { title: { contains: q, mode: "insensitive" } },
      { company: { contains: q, mode: "insensitive" } },
      { location: { contains: q, mode: "insensitive" } },
      { experience: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ],
  };
}
