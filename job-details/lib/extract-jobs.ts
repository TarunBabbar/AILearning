import { callOpenRouter, extractJsonArray } from "./openrouter";
import { chunkText } from "./extract";
import { createLogger, type Logger } from "./logger";

export type ExtractedJob = {
  title: string;
  company: string;
  email: string;
  location: string;
  experience: string;
  description: string;
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

CRITICAL: Respond with ONLY a valid JSON array. NO markdown, NO code blocks, NO explanation, NO text before or after. Just the JSON array:
[{"company":"...","title":"...","email":"...","location":"...","experience":"...","description":"..."}]

TEXT:
${text}`;
}

export async function extractJobsFromText(
  rawText: string,
  apiKey: string,
  model: string,
  opts: { onProgress?: (p: ExtractProgress) => void; log?: Logger } = {}
): Promise<ExtractedJob[]> {
  const log = opts.log ?? createLogger();
  const chunks = chunkText(rawText, 6000, 400);
  const allJobs: ExtractedJob[] = [];

  log.info(
    "extract",
    `Starting extraction · ${rawText.length.toLocaleString()} chars split into ${chunks.length} chunk(s)`,
    `model=${model}`
  );

  for (let c = 0; c < chunks.length; c++) {
    const chunkStart = Date.now();
    opts.onProgress?.({
      phase: "chunk_start",
      chunk: c + 1,
      totalChunks: chunks.length,
      message: `Sending chunk ${c + 1}/${chunks.length} to the LLM…`,
    });
    log.info(
      "extract",
      `Chunk ${c + 1}/${chunks.length} → LLM`,
      `${chunks[c].length} chars`
    );

    const prompt = buildExtractionPrompt(chunks[c]);
    const content = await callOpenRouter(
      prompt,
      EXTRACTION_SYSTEM_PROMPT,
      apiKey,
      { model, maxTokens: 8192, timeoutMs: 120000 },
      log
    );

    const parsed = extractJsonArray<Partial<ExtractedJob>>(content);
    if (!parsed) {
      log.warn(
        "extract",
        `Chunk ${c + 1}/${chunks.length} returned no JSON array — skipping`,
        `response ${content.length} chars`
      );
      opts.onProgress?.({
        phase: "chunk_parse_error",
        chunk: c + 1,
        totalChunks: chunks.length,
        message: `Chunk ${c + 1}/${chunks.length} returned no usable JSON — skipped.`,
      });
      continue;
    }

    for (const j of parsed) {
      allJobs.push({
        title: normalizeTitle(j.title),
        company: cleanCompany(j.company || ""),
        email: (j.email || "").trim(),
        location: (j.location || "").trim(),
        experience: (j.experience || "").trim(),
        description: (j.description || "").trim(),
      });
    }

    log.info(
      "extract",
      `Chunk ${c + 1}/${chunks.length} done`,
      `${parsed.length} job(s) found · ${ms(Date.now() - chunkStart)}`
    );
    opts.onProgress?.({
      phase: "chunk_done",
      chunk: c + 1,
      totalChunks: chunks.length,
      foundJobs: parsed.length,
      message: `Chunk ${c + 1}/${chunks.length} parsed — ${parsed.length} job(s) found.`,
    });
  }

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
    chunk: chunks.length,
    totalChunks: chunks.length,
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
