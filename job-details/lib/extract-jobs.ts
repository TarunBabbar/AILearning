import { callOpenRouter, extractJsonArray } from "./openrouter";
import { chunkText, parseJobDate } from "./extract";
import { stripSpamText } from "./sanitize";
import { createLogger, type Logger } from "./logger";

export type ExtractedJob = {
  title: string;
  company: string;
  email: string;
  location: string;
  experience: string;
  description: string;
  jobDate: Date | null;
};

/** Raw shape the LLM returns — jobDate comes back as a string (or null). */
type RawExtractedJob = Omit<ExtractedJob, "jobDate"> & {
  jobDate?: string | null;
};

/** Progress callback for the extraction pipeline (chunk-level). */
export type ExtractProgress = {
  phase: "chunk_start" | "chunk_done" | "chunk_parse_error" | "dedupe";
  chunk: number;
  totalChunks: number;
  foundJobs?: number;
  message: string;
};

const FALLBACK_TITLE = "Unknown Position";

function normalizeTitle(title: string | undefined): string {
  if (!title || typeof title !== "string") return FALLBACK_TITLE;
  const trimmed = title.trim();
  if (trimmed.length > 120) return FALLBACK_TITLE;
  if (/unknown position|job application|undefined|null|n\/a|tbd|none/i.test(trimmed)) {
    return FALLBACK_TITLE;
  }
  return trimmed || FALLBACK_TITLE;
}

function cleanCompany(company: string): string {
  const cleaned = (company || "")
    .replace(/[\d+\-]+/g, "")
    .replace(/^[:\s]+|[:\s]+$/g, "")
    .trim();
  return cleaned || "Unknown Company";
}

const EXTRACTION_SYSTEM_PROMPT =
  "You are a precise job listing extractor. Extract all job listings from the user-provided text. Respond with ONLY valid JSON. No markdown. No code fences. No explanation before or after the JSON.";

function buildExtractionPrompt(text: string): string {
  return `Extract ALL job listings from the text below. Do NOT miss any job.

For each job, identify:
- company (company name)
- title (job title / position)
- email (contact / application email)
- location (city/locations mentioned — e.g. "Pune", "Bangalore", "Remote", etc.)
- experience (years of experience required, e.g. "2+ years", "5-8 Yrs", "Fresher", etc. Use the exact text found)
- description (full job description text — include ALL details)
- jobDate (the posting date if present in the text, e.g. "07-Aug-2025" or "7 August 2025". Use the same format as found. If no date is found use null)

CRITICAL: Respond with ONLY a valid JSON array. NO markdown, NO code blocks, NO explanation, NO text before or after. Just the JSON array:
[{"company":"...","title":"...","email":"...","location":"...","experience":"...","description":"...","jobDate":"..."}]

TEXT:
${text}`;
}

const FREE_MODELS_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h
let freeModelsCache: { at: number; models: string[] } | null = null;

// Curated free models for extraction, ordered FASTEST → SLOWEST.
// All chunks start with the first (fastest) model in parallel; if a chunk
// fails with it, it falls back to the next model in this order, and so on.
const EXTRACTION_MODELS = [
  "nvidia/nemotron-nano-9b-v2:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "google/gemma-4-26b-a4b-it:free",
  "google/gemma-4-31b-it:free",
  "openai/gpt-oss-20b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
];

/**
 * Fetch the list of currently-free models that are on the curated
 * EXTRACTION_MODELS allowlist (they must still be free today).
 * Cached for 6 hours.
 */
async function getFreeModelIds(log: Logger): Promise<string[]> {
  if (freeModelsCache && Date.now() - freeModelsCache.at < FREE_MODELS_CACHE_TTL_MS) {
    return freeModelsCache.models;
  }
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      next: { revalidate: FREE_MODELS_CACHE_TTL_MS },
    });
    if (!res.ok) throw new Error(`OpenRouter models ${res.status}`);
    const data = await res.json();
    const freeSet = new Set<string>(
      (data.data || [])
        .filter(
          (m: { pricing?: { prompt?: string; completion?: string } }) =>
            parseFloat(m.pricing?.prompt || "0") === 0 &&
            parseFloat(m.pricing?.completion || "0") === 0
        )
        .map((m: { id: string }) => m.id)
    );
    const ids = EXTRACTION_MODELS.filter((id) => freeSet.has(id));
    if (!ids.length) throw new Error("None of the curated models are free right now");
    freeModelsCache = { at: Date.now(), models: ids };
    log.info("extract", `Using ${ids.length} curated model(s)`, ids.join(", "));
    return ids;
  } catch (e) {
    // Fall back to the curated list as-is if the fetch fails
    log.warn("extract", "Failed to fetch free models, using curated list", (e as Error).message);
    return [...EXTRACTION_MODELS];
  }
}

/**
 * Pick the next untried model, following the curated order
 * (fastest → slowest). Returns null when every model has been tried.
 */
function pickNextModel(models: string[], tried: Set<string>): string | null {
  return models.find((m) => !tried.has(m)) ?? null;
}

export async function extractJobsFromText(
  rawText: string,
  apiKey: string,
  _preferredModel: string,
  opts: {
    onProgress?: (p: ExtractProgress) => void;
    log?: Logger;
    /** Called with each chunk's extracted jobs as soon as that chunk lands. */
    onChunk?: (jobs: ExtractedJob[], chunkNum: number, totalChunks: number) => void | Promise<void>;
  } = {}
): Promise<ExtractedJob[]> {
  const log = opts.log ?? createLogger();
  const chunks = chunkText(rawText, 6000, 400);
  const totalChunks = chunks.length;

  log.info(
    "extract",
    `Starting parallel extraction · ${rawText.length.toLocaleString()} chars → ${totalChunks} chunk(s)`,
    "chunks rotate starting models round-robin"
  );

  // One shared list of free models; each chunk starts on a different model
  // (round-robin), then falls back through the others on failure.
  const freeModels = await getFreeModelIds(log);
  if (!freeModels.length) {
    log.error("extract", "No free models available", "aborting");
    return [];
  }

  // All chunks start in parallel, but each chunk picks a DIFFERENT model as
  // its first attempt (round-robin with a random offset). If every chunk
  // started on the same fastest model, N parallel calls would hit one
  // provider at once and all get rate-limited (429) together.
  const firstModel = freeModels[0];
  if (!firstModel) return [];
  const startOffset = Math.floor(Math.random() * freeModels.length);

  // ── Parallel extraction: one LLM call per chunk, all fired at once ──
  const results = await Promise.all(
    chunks.map(async (chunkText, i) => {
      const chunkNum = i + 1;
      const prompt = buildExtractionPrompt(chunkText);
      const tried = new Set<string>();
      let model = freeModels[(startOffset + i) % freeModels.length];

      opts.onProgress?.({
        phase: "chunk_start",
        chunk: chunkNum,
        totalChunks,
        message: `Sending chunk ${chunkNum}/${totalChunks} to ${model.replace(":free", "")}…`,
      });
      log.info("extract", `Chunk ${chunkNum}/${totalChunks} → ${model}`, `${chunkText.length} chars`);

      // Retry each chunk with a different random model until valid JSON.
      // Max attempts = number of curated models, so every chunk tries ALL
      // models before being marked a bad chunk.
      const MAX_ATTEMPTS = freeModels.length;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        tried.add(model);
        let content: string;
        try {
          content = await callOpenRouter(
            prompt,
            EXTRACTION_SYSTEM_PROMPT,
            apiKey,
            // Short retry budget: a rate-limited (429) free model should fail
            // fast so the chunk can switch to a different provider instead of
            // burning the Vercel function budget on backoff sleeps.
            { model, maxTokens: 8192, maxRetries: 2, maxRetryDelayMs: 20_000 },
            log
          );
        } catch (e) {
          // A provider/API error (400, 5xx, rate limit) — treat as a failed
          // attempt and switch to another free model for the retry.
          const errMsg = e instanceof Error ? e.message : "LLM call failed";
          if (attempt < MAX_ATTEMPTS) {
            log.warn(
              "extract",
              `Chunk ${chunkNum}/${totalChunks} attempt ${attempt}/${MAX_ATTEMPTS} error from ${model.replace(":free", "")} — switching model`,
              errMsg
            );
            opts.onProgress?.({
              phase: "chunk_parse_error",
              chunk: chunkNum,
              totalChunks,
              message: `Chunk ${chunkNum}/${totalChunks} hit an error with ${model.replace(":free", "")} — retrying with another model…`,
            });
            const next = pickNextModel(freeModels, tried);
            if (!next) break; // no untried models left — give up on this chunk
            model = next;
            continue;
          }
          log.warn(
            "extract",
            `Chunk ${chunkNum}/${totalChunks} failed after ${MAX_ATTEMPTS} attempts`,
            errMsg
          );
          break;
        }
        const parsed = extractJsonArray<Partial<RawExtractedJob>>(content);
        if (parsed) {
          const jobs = parsed.map((j) => ({
            title: normalizeTitle(j.title),
            company: cleanCompany(j.company || ""),
            email: (j.email || "").trim(),
            location: (j.location || "").trim(),
            experience: (j.experience || "").trim(),
            description: stripSpamText(j.description || ""),
            jobDate: parseJobDate(j.jobDate),
          }));
          opts.onProgress?.({
            phase: "chunk_done",
            chunk: chunkNum,
            totalChunks,
            foundJobs: jobs.length,
            message: `Chunk ${chunkNum}/${totalChunks} parsed by ${model.replace(":free", "")} — ${jobs.length} job(s).`,
          });
          // Persist this chunk's jobs immediately — don't wait for the rest.
          await opts.onChunk?.(jobs, chunkNum, totalChunks);
          return jobs;
        }

        if (attempt < MAX_ATTEMPTS) {
          const next = pickNextModel(freeModels, tried);
          if (!next) break; // no untried models left — give up on this chunk
          const oldModel = model;
          model = next;
          log.warn(
            "extract",
            `Chunk ${chunkNum}/${totalChunks} attempt ${attempt}/${MAX_ATTEMPTS} bad JSON from ${oldModel.replace(":free", "")} — switching to ${model.replace(":free", "")}`,
            `response ${content.length} chars`
          );
          opts.onProgress?.({
            phase: "chunk_parse_error",
            chunk: chunkNum,
            totalChunks,
            message: `Chunk ${chunkNum}/${totalChunks} returned no usable JSON — retrying with ${model.replace(":free", "")}…`,
          });
        } else {
          log.warn(
            "extract",
            `Chunk ${chunkNum}/${totalChunks} is a bad chunk — failed with all ${MAX_ATTEMPTS} models`,
            `models tried: ${[...tried].join(", ")}`
          );
          opts.onProgress?.({
            phase: "chunk_parse_error",
            chunk: chunkNum,
            totalChunks,
            message: `Chunk ${chunkNum}/${totalChunks} failed with all ${MAX_ATTEMPTS} models — skipped as bad chunk.`,
          });
        }
      }
      return [] as ExtractedJob[];
    })
  );

  const allJobs = results.flat();
  log.info("extract", `All ${totalChunks} chunk(s) finished`, `${allJobs.length} raw job(s)`);

  // Dedupe by title|email|company
  const seen = new Set<string>();
  const unique: ExtractedJob[] = [];
  for (const j of allJobs) {
    const key = `${j.title}|${j.email}|${j.company}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(j);
  }

  if (allJobs.length !== unique.length) {
    log.info(
      "extract",
      `Deduped ${allJobs.length} → ${unique.length} job(s)`,
      `${allJobs.length - unique.length} duplicate(s) removed`
    );
  } else {
    log.info("extract", `Extraction complete — ${unique.length} job(s)`, "no duplicates");
  }
  opts.onProgress?.({
    phase: "dedupe",
    chunk: totalChunks,
    totalChunks,
    foundJobs: unique.length,
    message: `Filtering done — ${unique.length} unique job(s).`,
  });

  return unique;
}

// Small local helper to keep this file free of extra imports
function ms(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
