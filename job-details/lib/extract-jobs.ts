import { callOpenRouter, extractJsonArray } from "./openrouter";
import { chunkText } from "./extract";

export type ExtractedJob = {
  title: string;
  company: string;
  email: string;
  location: string;
  experience: string;
  description: string;
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
  model: string
): Promise<ExtractedJob[]> {
  const chunks = chunkText(rawText, 6000, 400);
  const allJobs: ExtractedJob[] = [];

  for (let c = 0; c < chunks.length; c++) {
    const prompt = buildExtractionPrompt(chunks[c]);
    const content = await callOpenRouter(prompt, EXTRACTION_SYSTEM_PROMPT, apiKey, {
      model,
      maxTokens: 8192,
      timeoutMs: 120000,
    });
    const parsed = extractJsonArray<Partial<ExtractedJob>>(content);
    if (!parsed) {
      console.error(
        `[extract] chunk ${c + 1}/${chunks.length} returned no JSON array`
      );
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

  return unique;
}
