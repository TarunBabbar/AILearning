import { getOpenRouterClient } from "../openrouter";
import { getConfig } from "../config";

interface QAPair {
  question: string;
  answer: string;
}

/**
 * Clean common PDF watermark/noise patterns from extracted text.
 */
function cleanNoise(text: string): string {
  return text
    // Strip WHATSAPP91-... noise (any digits after WHATSAPP)
    .replace(/WHATSAPP\d+/gi, "")
    // Strip "91-6232667387" phone noise
    .replace(/\d{2,}-\d{7,}/g, "")
    // Strip standalone long digit strings
    .replace(/\b\d{7,}\b/g, "")
    // Strip FORQAJOBS / ForQAJobs etc
    .replace(/ForQAJobs/gi, "")
    // Strip SoftwareTestingStudio
    .replace(/SoftwareTestingStudio/gi, "")
    // Strip pipe-separated uppercase combos
    .replace(/\|[A-Z&|]+\||\|[A-Z&|]+\b/g, "")
    // Strip all-caps lines that are clearly noise (10+ chars, no spaces or only one word)
    .replace(/^[A-Z\s]{15,}$/gm, "")
    // Clean up excessive blank lines
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Fallback: split text into chunks and extract first ?-sentence as question.
 */
function fallbackExtract(text: string, chunkSize = 1500): QAPair[] {
  const separators = ["\n\n", "\n", ". ", "? ", "! ", " ", ""];
  const pairs: QAPair[] = [];

  const cleaned = cleanNoise(text);

  function split(t: string, depth: number): string[] {
    if (depth >= separators.length) return [t];
    const sep = separators[depth];
    const parts = t.split(sep);
    if (parts.length <= 1) return split(t, depth + 1);
    const res: string[] = [];
    for (const p of parts) {
      res.push(...split(p, depth + 1));
    }
    return res;
  }

  const splits = split(cleaned, 0);
  let current = "";
  for (const s of splits) {
    if ((current + s).length > chunkSize && current.length > 0) {
      const trimmed = current.trim();
      if (trimmed.length > 50) {
        const qMatch = trimmed.match(/(?:^|[.!?\n])\s*([A-Z][^.?!]{10,}?\?)/);
        pairs.push({
          question: qMatch ? qMatch[1].trim() : trimmed.substring(0, 150).replace(/^[^a-zA-Z]+/, ""),
          answer: trimmed,
        });
      }
      const words = current.split(" ");
      const overlap = words.slice(Math.max(0, words.length - 20)).join(" ");
      current = overlap + " " + s;
    } else {
      current += s;
    }
  }
  if (current.trim().length > 50) {
    const trimmed = current.trim();
    const qMatch = trimmed.match(/(?:^|[.!?\n])\s*([A-Z][^.?!]{10,}?\?)/);
    pairs.push({
      question: qMatch ? qMatch[1].trim() : trimmed.substring(0, 150).replace(/^[^a-zA-Z]+/, ""),
      answer: trimmed,
    });
  }

  return pairs;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function repairTruncatedJson(raw: string): string {
  // Strip markdown fences
  let s = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

  // If the array was truncated, cap it
  // Count opening vs closing braces — if unbalanced, assume truncated
  let opens = 0, closes = 0;
  for (const ch of s) {
    if (ch === "{") opens++;
    if (ch === "}") closes++;
  }

  if (opens > closes) {
    // Truncated — try to close the last object
    s = s.replace(/,\s*$/, "") + "}";
    closes++;
  }

  if (opens > closes) {
    s = s.replace(/,\s*$/, "") + "}";
  }

  // Ensure array is closed
  const firstBracket = s.indexOf("[");
  if (firstBracket !== -1 && !s.endsWith("]")) {
    s = s.replace(/,\s*$/, "") + "]";
  }

  return s;
}

function tryParseJson(raw: string): QAPair[] | null {
  let cleaned = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

  // Try direct parse
  try { return JSON.parse(cleaned); } catch {}

  // Try basic unescaped-quote repair
  try {
    const repaired = cleaned
      .replace(/(\w)"(\w)/g, "$1'$2")
      .replace(/(\w)"(\s)/g, "$1'$2")
      .replace(/(\s)"(\w)/g, "$1'$2");
    return JSON.parse(repaired);
  } catch {}

  // Try truncated JSON repair
  try {
    const truncatedFixed = repairTruncatedJson(cleaned);
    const repairedTrunc = truncatedFixed
      .replace(/(\w)"(\w)/g, "$1'$2")
      .replace(/(\w)"(\s)/g, "$1'$2")
      .replace(/(\s)"(\w)/g, "$1'$2");
    return JSON.parse(repairedTrunc);
  } catch {}

  return null;
}

/**
 * Use LLM to extract clean Q&A pairs from raw PDF text.
 * Retries transient failures with exponential backoff.
 */
export async function extractQAPairs(text: string): Promise<QAPair[]> {
  const config = getConfig();
  const client = getOpenRouterClient();

  const MAX_CHARS = 60000;
  const truncated = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;

  const MAX_RETRIES = 3;
  let lastError: string = "";

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 1) {
      const delay = Math.min(2000 * Math.pow(2, attempt - 2), 10000);
      console.log(`    Retry ${attempt - 1}/${MAX_RETRIES - 1} (waiting ${delay}ms)...`);
      await sleep(delay);
    }

    try {
      console.log(`    Sending ${(truncated.length / 1024).toFixed(0)}KB to LLM (model: ${config.llmModel}) [attempt ${attempt}/${MAX_RETRIES}]...`);

      const response = await client.chat.completions.create({
        model: config.llmModel,
        messages: [
          {
            role: "system",
            content: `You are an extractor that finds Q&A pairs in interview preparation PDFs.

Rules:
1. Extract EVERY question-answer pair you find
2. Return a JSON array of {"question": "...", "answer": "..."} objects
3. question: the exact question text (keep as-is)
4. answer: the full answer text (keep as-is)
5. IMPORTANT: Escape any double quotes inside answer text with backslash: "text" becomes \"text\"
6. Skip headers, footers, watermarks, page numbers, contact info, social media links
7. If you find NONE, return an empty array []
8. Return ONLY valid JSON, no markdown, no explanation`,
          },
          {
            role: "user",
            content: `Extract all Q&A pairs from this PDF text:\n\n${truncated}`,
          },
        ],
        temperature: 0,
      });

      const content = (response.choices[0]?.message?.content || "").trim();

      if (!content) {
        lastError = "LLM returned empty response";
        continue;
      }

      console.log(`    LLM response preview: ${content.slice(0, 200).replace(/\n/g, " ")}`);

      const parsed = tryParseJson(content);
      if (!parsed) {
        lastError = "LLM returned invalid JSON";
        console.log(`    ⚠ Invalid JSON (attempt ${attempt}/${MAX_RETRIES})`);
        continue;
      }

      const pairs = Array.isArray(parsed)
        ? parsed
        : parsed.qa_pairs || parsed.questions || parsed.pairs || [];

      if (!Array.isArray(pairs)) {
        lastError = "LLM returned unexpected format";
        continue;
      }

      const valid = pairs
        .filter((p: any) => p.question && p.answer)
        .map((p: any) => ({
          question: p.question.trim(),
          answer: p.answer.trim(),
        }));

      if (valid.length === 0) {
        console.log(`    ℹ No Q&A pairs found in this document (returning empty)`);
        return [];
      }

      return valid;
    } catch (err: any) {
      lastError = err.message || "Unknown error";
      console.log(`    ⚠ Error: ${lastError.slice(0, 150)} (attempt ${attempt}/${MAX_RETRIES})`);
    }
  }

  throw new Error(lastError || "Extraction failed after retries");
}
