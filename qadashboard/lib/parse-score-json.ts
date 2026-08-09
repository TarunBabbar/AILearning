/**
 * Parse LLM scoring responses that are often truncated or wrapped in markdown.
 * Recovers complete objects even when the trailing ] is missing.
 */
export function parseScoreJsonArray(
  content: string
): Array<{ idx?: number; score?: number; strengths?: string; gaps?: string }> {
  if (!content?.trim()) return [];

  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let text = (fenced ? fenced[1] : content).trim();

  // Prefer a complete array if present
  const complete = text.match(/\[[\s\S]*\]/);
  if (complete) {
    try {
      const parsed = JSON.parse(complete[0]);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fall through to object recovery
    }
  }

  // Truncated array: pull every complete {...} object
  const start = text.indexOf("[");
  if (start >= 0) text = text.slice(start + 1);

  const objects: Array<{
    idx?: number;
    score?: number;
    strengths?: string;
    gaps?: string;
  }> = [];

  const re = /\{[^{}]*\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    try {
      const obj = JSON.parse(m[0]);
      if (obj && typeof obj === "object") objects.push(obj);
    } catch {
      // skip broken fragment
    }
  }

  return objects;
}
