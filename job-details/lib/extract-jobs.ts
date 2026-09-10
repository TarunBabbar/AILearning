import { callOpenRouter, extractJsonArray } from "./openrouter";
import { chunkText, parseJobDate } from "./extract";
import { stripSpamText } from "./sanitize";
import { createLogger, type Logger } from "./logger";
import { listFreeOpenRouterModelIds } from "./free-models";
import { getConfig } from "./config";

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

/**
 * Build the extraction model pool:
 *  - CMD mode (CMD_API_KEY set): the CMD_MODEL only (DeepSeek V4 Flash by
 *    default) — OpenRouter free models are never used.
 *  - OpenRouter mode: preferred model first, then ALL currently-free
 *    OpenRouter models (fastest first), so chunks spread across the free pool.
 */
async function buildModelPool(preferredModel: string, log: Logger): Promise<string[]> {
  // CMD mode: just the CMD model. Ignore the preferred model entirely —
  // OpenRouter free LLMs are not used anymore.
  const cfg = getConfig();
  if (cfg.cmdApiKey) {
    const model = cfg.cmdModel; // from CMD_MODEL env
    if (!model) {
      log.error("extract", "CMD mode — CMD_MODEL not set in environment", "aborting");
      return [];
    }
    log.info("extract", "CMD mode — using Command Code model", model);
    return [model];
  }

  let freeModels: string[] = [];
  try {
    freeModels = await listFreeOpenRouterModelIds();
    if (freeModels.length) {
      log.info(
        "extract",
        `Fetched ${freeModels.length} free model(s) from OpenRouter`,
        freeModels.slice(0, 8).join(", ") + (freeModels.length > 8 ? "…" : "")
      );
    }
  } catch (e) {
    log.warn(
      "extract",
      "Failed to fetch free models from OpenRouter",
      (e as Error).message
    );
  }

  const pool = preferredModel
    ? [preferredModel, ...freeModels.filter((m) => m !== preferredModel)]
    : freeModels;
  if (!pool.length) {
    // Last resort: hardcoded known-free models so a network blip doesn't
    // brick the upload page entirely.
    log.warn("extract", "No live free models — using hardcoded fallback list");
    return [
      "nvidia/nemotron-nano-9b-v2:free",
      "nvidia/nemotron-3-nano-30b-a3b:free",
      "openai/gpt-oss-20b:free",
    ];
  }
  return pool;
}

/**
 * Pick the next untried model, following the curated order
 * (fastest → slowest). Returns null when every model has been tried.
 */
function pickNextModel(models: string[], tried: Set<string>): string | null {
  return models.find((m) => !tried.has(m)) ?? null;
}

export type ExtractBatchOutcome = {
  jobs: ExtractedJob[];
  /** Total chunks the document splits into (stable across batches). */
  totalChunks: number;
  /**
   * First chunk index NOT processed in this batch, or null when the document
   * is finished. Callers resume with `chunkOffset: nextChunk`.
   */
  nextChunk: number | null;
};

/**
 * Extract one batch of chunks. Chunking is deterministic, so a caller can
 * resume with `chunkOffset`: every request stays comfortably inside the
 * platform's function timeout no matter how large the document is or how slow
 * the upstream model runs.
 */
export async function extractJobsBatch(
  rawText: string,
  apiKey: string,
  preferredModel: string,
  opts: {
    onProgress?: (p: ExtractProgress) => void;
    log?: Logger;
    /** Called with each chunk's extracted jobs as soon as that chunk lands. */
    onChunk?: (jobs: ExtractedJob[], chunkNum: number, totalChunks: number) => void | Promise<void>;
    /**
     * Absolute epoch-ms budget for THIS batch. Once passed, no further chunk is
     * dispatched — at least one always runs, so batches always make progress.
     */
    deadlineMs?: number;
    /** Chunk index to start at (0-based). Defaults to 0. */
    chunkOffset?: number;
    /** Max chunks to process in this batch. Defaults to all remaining. */
    maxChunks?: number;
  } = {}
): Promise<ExtractBatchOutcome> {
  const log = opts.log ?? createLogger();

  // Chunk size drives how long each model response takes. The Command Code
  // gateway (Cloudflare) returns 524 when a request produces no response for
  // ~2 minutes, so a chunk must be small enough that the model finishes well
  // inside that window — otherwise every attempt dies on the gateway timeout
  // regardless of retries. 4,000 chars ≈ 1-3 job listings.
  const chunkSize = Math.max(1000, Number(process.env.EXTRACT_CHUNK_SIZE) || 4000);
  const chunkOverlap = Math.round(chunkSize * 0.075);
  const chunks = chunkText(rawText, chunkSize, chunkOverlap);
  const totalChunks = chunks.length;

  // This batch's slice of the document.
  const start = Math.min(Math.max(0, Math.floor(opts.chunkOffset ?? 0)), totalChunks);
  const requestedEnd =
    opts.maxChunks && opts.maxChunks > 0
      ? Math.min(totalChunks, start + Math.floor(opts.maxChunks))
      : totalChunks;
  const batchChunks = chunks.slice(start, requestedEnd);

  log.info(
    "extract",
    `Extracting chunks ${start + 1}-${requestedEnd} of ${totalChunks} · ${rawText.length.toLocaleString()} chars`,
    `preferred=${preferredModel || "none"}`
  );

  // Model pool: preferred (OPENROUTER_MODEL / upload selection) first, then
  // ALL live free OpenRouter models. Chunks round-robin through the whole
  // pool so parallel calls spread across every free LLM.
  const modelPool = await buildModelPool(preferredModel, log);
  if (!modelPool.length) {
    log.error("extract", "No free models available", "aborting");
    return { jobs: [], totalChunks, nextChunk: null };
  }
  const firstModel = modelPool[0];
  if (!firstModel) return { jobs: [], totalChunks, nextChunk: null };
  const startOffset = Math.floor(Math.random() * modelPool.length);

  // ── Parallel extraction, bounded concurrency ──
  // Firing every chunk at once against a rate-limited provider slams it with
  // a burst of requests → aggregate 429s. Cap how many chunks hit the model
  // simultaneously. Higher = faster; the retry/jitter layer absorbs residual
  // rate limits. Tune via env if needed.
  const MAX_PARALLEL = Math.max(1, Number(process.env.EXTRACT_CONCURRENCY) || 5);

  // Output budget per chunk. This was 24,000 to dodge "finish_reason: length"
  // truncation, but that lets a single response generate for minutes — which
  // trips the gateway's ~120s timeout (HTTP 524) on every attempt. With 4k-char
  // chunks a few thousand tokens is ample for the JSON payload.
  const extractMaxTokens = Math.max(1000, Number(process.env.EXTRACT_MAX_TOKENS) || 8000);

  // How far this batch got. Dispatch is sequential (shared cursor), so this is
  // the resume point handed back to the caller.
  let dispatched = 0;

  const results = await mapWithConcurrency(
    batchChunks,
    MAX_PARALLEL,
    async (chunkText, i) => {
      // Document-wide chunk number, so progress and resume points align.
      const chunkNum = start + i + 1;

      // Stop dispatching once the batch budget is spent — chunks already saved
      // are kept and the caller resumes at `dispatched`. The first chunk of a
      // batch always runs, so a batch can never spin without making progress.
      if (opts.deadlineMs && dispatched > 0 && Date.now() >= opts.deadlineMs) {
        log.warn(
          "extract",
          `Skipping chunk ${chunkNum}/${totalChunks} — batch time budget exhausted`,
          "resuming here in the next batch"
        );
        return [] as ExtractedJob[];
      }
      dispatched = i + 1;

      const prompt = buildExtractionPrompt(chunkText);
      const tried = new Set<string>();
      let model = modelPool[(startOffset + chunkNum) % modelPool.length];

      opts.onProgress?.({
        phase: "chunk_start",
        chunk: chunkNum,
        totalChunks,
        message: `Sending chunk ${chunkNum}/${totalChunks} to ${model.replace(":free", "")}…`,
      });
      log.info("extract", `Chunk ${chunkNum}/${totalChunks} → ${model}`, `${chunkText.length} chars`);

      // Retry each chunk with a different model until valid JSON. Max attempts
      // covers the whole pool, so each chunk tries ALL free models before
      // being marked a bad chunk.
      const MAX_ATTEMPTS = modelPool.length;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        tried.add(model);
        let content: string;
        try {
          content = await callOpenRouter(
            prompt,
            EXTRACTION_SYSTEM_PROMPT,
            apiKey,
            // Per-chunk output budget (see extractMaxTokens above) plus a
            // deadline so a slow upstream can't burn the whole function
            // timeout on retries that can never finish in time.
            // Jittered backoff (added in callOpenRouter) desyncs parallel
            // chunks so they don't re-hammer upstream in lockstep.
            {
              model,
              maxTokens: extractMaxTokens,
              maxRetries: Number(process.env.EXTRACT_MAX_RETRIES) || 3,
              maxRetryDelayMs: 60_000,
              deadlineMs: opts.deadlineMs,
              // Stream so long generations keep the gateway connection alive
              // (a silent non-streamed request is what returns HTTP 524).
              stream: true,
            },
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
            const next = pickNextModel(modelPool, tried);
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
          const next = pickNextModel(modelPool, tried);
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
    }
  );

  const allJobs = results.flat();

  // Dedupe by title|email|company within this batch. Cross-batch duplicates are
  // caught when the caller persists (it dedupes against the database).
  const seen = new Set<string>();
  const unique: ExtractedJob[] = [];
  for (const j of allJobs) {
    const key = `${j.title}|${j.email}|${j.company}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(j);
  }

  const resumeAt = Math.min(start + dispatched, totalChunks);
  const nextChunk = resumeAt >= totalChunks ? null : resumeAt;
  log.info(
    "extract",
    `Batch finished · chunks ${start + 1}-${start + dispatched} of ${totalChunks} → ${unique.length} job(s)`,
    nextChunk == null ? "document complete" : `resume at chunk ${nextChunk + 1}`
  );
  opts.onProgress?.({
    phase: "dedupe",
    chunk: resumeAt,
    totalChunks,
    foundJobs: unique.length,
    message:
      nextChunk == null
        ? `Filtering done — ${unique.length} unique job(s).`
        : `Filtering done — ${unique.length} unique job(s) in this batch; continuing…`,
  });

  return { jobs: unique, totalChunks, nextChunk };
}

/**
 * Run an async map over `items` with at most `limit` promises in flight at
 * once. Preserves input order (result[i] corresponds to items[i]).
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) break;
      results[i] = await fn(items[i], i);
    }
  }

  const n = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}

// Small local helper to keep this file free of extra imports
function ms(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
