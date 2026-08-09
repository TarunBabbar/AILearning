import { getConfig } from "./config";
import { chatCompletion, assertFreeModel } from "./openrouter";
import { parseScoreJsonArray } from "./parse-score-json";
import { upsertJobOverlays, type OverlayUpsert } from "./job-overlay";
import type { RemoteJob } from "./job-board-api";

export const SCORE_JOBS_PER_MODEL = 10;
const MODEL_MAX_TRIES = 2;
const RESUME_CHARS = 5000;
const DESC_CHARS = 320;
/** Only persist / surface matches at or above this score. */
export const STRONG_MATCH_MIN = 60;

export type ScoreResult = {
  jobId: string;
  score: number;
  strengths: string | null;
  gaps: string | null;
};

export type StrongMatchPayload = {
  id: string;
  title: string;
  company: string;
  email?: string | null;
  location?: string | null;
  experience?: string | null;
  description?: string | null;
  status: string;
  score: number;
  strengths: string | null;
  gaps: string | null;
  emailSent: boolean;
  originalId: string;
};

function freeModelsFromEnv(): string[] {
  const cfg = getConfig();
  const ids = cfg.llmModels.map((m) => m.id).filter(Boolean);
  const withDefault = cfg.llmModel ? [cfg.llmModel, ...ids] : ids;
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const id of withDefault) {
    try {
      assertFreeModel(id);
    } catch {
      continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
  }
  return unique;
}

export function scoringModelIds(): string[] {
  const models = freeModelsFromEnv();
  if (models.length) return models;
  const fallback = getConfig().llmModel;
  if (fallback) {
    try {
      assertFreeModel(fallback);
      return [fallback];
    } catch {
      return [];
    }
  }
  return [];
}

/** How many jobs one parallel wave can cover: models × 10. */
export function parallelWaveCapacity(): number {
  const n = Math.max(1, scoringModelIds().length);
  return n * SCORE_JOBS_PER_MODEL;
}

function chunkJobs<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function buildBatchPrompt(resumeText: string, batch: RemoteJob[]): string {
  const jobsBlock = batch
    .map(
      (j, i) =>
        `[${i}] Title: ${j.title}\nCompany: ${j.company}\nLocation: ${j.location || ""}\nExperience: ${j.experience || ""}\nDescription: ${(j.description || "").slice(0, DESC_CHARS)}`
    )
    .join("\n\n");

  return `You are a resume-job matcher. Score how well the resume matches each job from 0-100.

Evaluate skills overlap, experience alignment, domain relevance, and seniority fit.
Keep "strengths" and "gaps" to ONE short sentence each (max 12 words).

Resume:
${resumeText.slice(0, RESUME_CHARS)}

Jobs:
${jobsBlock}

Respond with ONLY a valid JSON array — no markdown, no prose:
[{"idx":0,"score":85,"strengths":"...","gaps":"..."}]`;
}

function parseScores(content: string, batch: RemoteJob[]): ScoreResult[] {
  const parsed = parseScoreJsonArray(content);
  if (!parsed.length) return [];

  const results: ScoreResult[] = [];
  const seen = new Set<number>();
  const hasZero = parsed.some((p) => Number(p.idx) === 0);

  for (const e of parsed) {
    let localIdx = Number(e.idx);
    if (!Number.isFinite(localIdx)) continue;
    // Accept 0-based; if model used 1-based and 0 is unused, shift down
    if (localIdx >= 1 && localIdx <= batch.length && !hasZero) {
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

async function scoreChunkWithModel(
  resumeText: string,
  batch: RemoteJob[],
  model: string
): Promise<ScoreResult[]> {
  let lastErr: Error | null = null;
  for (let tryNo = 1; tryNo <= MODEL_MAX_TRIES; tryNo++) {
    try {
      const content = await chatCompletion(
        [
          {
            role: "system",
            content:
              "You are a precise resume-job matching AI. Respond with ONLY valid JSON.",
          },
          { role: "user", content: buildBatchPrompt(resumeText, batch) },
        ],
        model,
        0.2,
        2048
      );
      const results = parseScores(content, batch);
      if (!results.length) throw new Error("Empty or unparseable score JSON");
      return results;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      const msg = lastErr.message;
      // Don't burn retries on auth/payment
      if (msg.includes("401") || msg.includes("402")) throw lastErr;
    }
  }
  throw lastErr ?? new Error(`Model ${model} failed`);
}

export type ParallelScoreProgress = {
  model: string;
  scoredDelta: number;
  attemptedInWave: number;
  strongMatches: number;
  /** Fired for every scored job (strong or weak) so UI can track skip list. */
  jobId: string;
  score: number;
  /** Present only when score >= STRONG_MATCH_MIN — ready for UI list + DB keep. */
  match?: StrongMatchPayload;
};

export type ParallelScoreResult = {
  scored: number;
  attempted: number;
  strongMatches: number;
  modelsUsed: string[];
  failedModels: string[];
  modelCount: number;
};

/**
 * Fan-out: one free model from LLM_MODELS_JSON per chunk of 10 jobs, all in parallel.
 * Only jobs with score >= 60 are persisted as user matches.
 * Weak scores are still written (minimal) so the same jobs are not re-scored forever.
 */
export async function scoreJobsAcrossModels(
  resumeText: string,
  jobs: RemoteJob[],
  userId: string,
  onProgress?: (info: ParallelScoreProgress) => void | Promise<void>
): Promise<ParallelScoreResult> {
  const models = scoringModelIds();
  if (!models.length) {
    throw new Error("No free models in LLM_MODELS_JSON / LLM_MODEL");
  }
  if (!jobs.length) {
    return {
      scored: 0,
      attempted: 0,
      strongMatches: 0,
      modelsUsed: [],
      failedModels: [],
      modelCount: models.length,
    };
  }

  const dead = new Set<string>();
  const used = new Set<string>();
  const waveJobs = jobs.slice(0, models.length * SCORE_JOBS_PER_MODEL);
  const chunks = chunkJobs(waveJobs, SCORE_JOBS_PER_MODEL).slice(0, models.length);
  const jobById = new Map(waveJobs.map((j) => [j.id, j]));

  const assignment = chunks.map((chunk, i) => ({
    chunk,
    model: models[i % models.length],
  }));

  function pickWorkingModel(exclude: Set<string>): string | null {
    return models.find((m) => !dead.has(m) && !exclude.has(m)) ?? null;
  }

  let scored = 0;
  let strongMatches = 0;
  const batchUpserts: OverlayUpsert[] = [];

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
          const results = await scoreChunkWithModel(resumeText, chunk, model);
          used.add(model);

          for (const s of results) {
            const job = jobById.get(s.jobId);
            if (!job) continue;

            batchUpserts.push({
              remote: job,
              data: {
                score: s.score,
                strengths: s.strengths,
                gaps: s.gaps,
                status: s.score >= STRONG_MATCH_MIN ? "new" : "ignored",
              },
            } as OverlayUpsert);

            scored += 1;
            let match: StrongMatchPayload | undefined;
            if (s.score >= STRONG_MATCH_MIN) {
              strongMatches += 1;
              match = {
                id: job.id,
                title: job.title,
                company: job.company,
                email: job.email,
                location: job.location,
                experience: job.experience,
                description: job.description,
                status: "new",
                score: s.score,
                strengths: s.strengths,
                gaps: s.gaps,
                emailSent: false,
                originalId: job.id,
              };
            }

            await onProgress?.({
              model,
              scoredDelta: 1,
              attemptedInWave: scored,
              strongMatches,
              jobId: s.jobId,
              score: s.score,
              match,
            });
          }
          return;
        } catch (e) {
          console.warn(
            `[score] model ${model} failed — blacklisting:`,
            e instanceof Error ? e.message.slice(0, 160) : e
          );
          dead.add(model);
          model = pickWorkingModel(triedForChunk);
        }
      }

      console.error(`[score] chunk abandoned — ${chunk.length} jobs unscored this wave`);
    })
  );

  // One batched DB flush for the whole wave (was: serialized 2 queries per job).
  if (batchUpserts.length > 0) {
    await upsertJobOverlays(userId, batchUpserts);
  }

  return {
    scored,
    attempted: waveJobs.length,
    strongMatches,
    modelsUsed: [...used],
    failedModels: [...dead],
    modelCount: models.length,
  };
}
