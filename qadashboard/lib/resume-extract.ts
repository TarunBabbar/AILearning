/**
 * Extract presentation-ready bits from a resume's raw text:
 * the person's name (for the email signature) and a short list of
 * skill highlights (for the email body bullets).
 * Used as a fallback when the stored Resume.highlights column is empty.
 */

export function extractResumeName(content: string): string | null {
  const line = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => {
      if (!l || l.length > 40) return false;
      if (/@|http|www|\d{5,}|[0-9]{3}[-.)\s]\s*[0-9]{3}/i.test(l)) return false;
      const words = l.split(/\s+/);
      return words.length <= 4 && words.every((w) => /^[A-Za-z.'-]+$/.test(w));
    });
  return line || null;
}

const SKILL_HEADINGS = /skills?|technologies?|tools?|expertise|competenc|proficien|areas?\s+of/gi;

/** Pick up to 4 concise skill bullets from the resume's skills section. */
export function extractResumeHighlights(content: string): string[] {
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];

  // Find the skills section start, else fall back to any bullet-ish lines.
  let start = 0;
  const headingIdx = lines.findIndex((l) => SKILL_HEADINGS.test(l) && l.length < 40);
  if (headingIdx >= 0) start = headingIdx + 1;

  const out: string[] = [];
  for (let i = start; i < lines.length && out.length < 4; i++) {
    const line = lines[i].replace(/^[-•*▪]\s*/, "").trim();
    if (!line || line.length < 3 || line.length > 120) continue;
    // Stop at the next section heading (short, no bullet, starts with a word).
    if (i > start && !/^[-•*▪]/.test(lines[i]) && line.length < 30 && /[A-Za-z]{3,}/.test(line) && !line.includes(",") && !line.includes("·")) break;
    // Split comma-separated skills into individual bullets.
    const parts = line.split(/[,·|]/).map((p) => p.trim()).filter((p) => p.length >= 2 && p.length <= 60);
    if (parts.length > 1) {
      out.push(...parts);
    } else {
      out.push(line);
    }
    if (out.length >= 4) break;
  }
  return out.slice(0, 4);
}
