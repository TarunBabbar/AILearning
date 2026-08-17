import { callOpenRouter, extractJsonObject } from "./openrouter";
import { resolveApiKey } from "./auth";

const QUALITY_SYSTEM_PROMPT =
  "You are a content moderator for a job-search portal. A user submitted a review. Reject ONLY reviews that are obvious spam or gibberish: random keystrokes (e.g. 'asdfghjkl', 'fdsfsfs'), gibberish text, or clearly off-topic content. APPROVE everything else — any real, meaningful sentence about the portal or job searching, even if it contains criticism or is short. When in doubt, approve. Reply with ONLY JSON: {\"approved\":true} or {\"approved\":false}.";

/**
 * Ask the LLM whether a review is meaningful enough to show publicly.
 * Only obvious gibberish/spam is rejected. Falls back to APPROVED on any
 * failure so a genuine review is never hidden by a model hiccup.
 */
export async function shouldApproveReview(
  name: string,
  message: string
): Promise<boolean> {
  const { apiKey } = resolveApiKey();
  if (!apiKey) return true;

  const prompt = `Review from "${name}":\n${message}`;
  try {
    const raw = await callOpenRouter(
      prompt,
      QUALITY_SYSTEM_PROMPT,
      apiKey,
      { maxTokens: 20, temperature: 0, maxRetries: 1 }
    );
    const parsed = extractJsonObject<{ approved?: boolean }>(raw);
    // Only reject on an explicit false — anything else approves.
    return parsed?.approved === false ? false : true;
  } catch {
    return true;
  }
}
