export function chunkText(text: string, size = 6000, overlap = 400): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(text.length, start + size);
    chunks.push(text.slice(start, end));
    if (end === text.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * Parse a job date from a filename or document text.
 * Supports: "07-Aug", "7 Aug 2025", "2025-08-07", "Aug 7, 2025", "07/08/2025".
 * Returns null when no date can be found.
 */
export function parseJobDate(input: string | null | undefined): Date | null {
  if (!input) return null;
  const s = input.trim();

  // ISO / numeric: 2025-08-07 or 07/08/2025 or 07-08-2025
  const iso = s.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (iso) {
    return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
  }
  const dmy = s.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
  if (dmy) {
    const year = Number(dmy[3]) < 100 ? 2000 + Number(dmy[3]) : Number(dmy[3]);
    return new Date(Date.UTC(year, Number(dmy[2]) - 1, Number(dmy[1])));
  }

  // "07-Aug", "7 Aug 2025", "Aug 7, 2025", "07 Aug 25"
  const named = s.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s*[- ]\s*([A-Za-z]{3,9})\b\s*,?\s*(\d{2,4})?\b/i);
  if (named) {
    const day = Number(named[1]);
    const month = MONTHS[named[2].toLowerCase().slice(0, 3)];
    if (month !== undefined) {
      let year = named[3] ? Number(named[3]) : new Date().getFullYear();
      if (year < 100) year = 2000 + year;
      return new Date(Date.UTC(year, month, day));
    }
  }
  const monthFirst = s.match(/\b([A-Za-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?\b\s*,?\s*(\d{2,4})?\b/i);
  if (monthFirst) {
    const month = MONTHS[monthFirst[1].toLowerCase().slice(0, 3)];
    if (month !== undefined) {
      const day = Number(monthFirst[2]);
      let year = monthFirst[3] ? Number(monthFirst[3]) : new Date().getFullYear();
      if (year < 100) year = 2000 + year;
      return new Date(Date.UTC(year, month, day));
    }
  }

  return null;
}
