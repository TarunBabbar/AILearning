import { NextRequest } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

type QAItem = { question: string; answer: string; source: string };
type QATopic = { name: string; questions: QAItem[] };

const STOP_WORDS = new Set([
  "what", "how", "why", "the", "and", "for", "are", "can", "you", "with",
  "your", "from", "using", "this", "that", "have", "not", "use", "write",
  "which", "when", "where", "explain", "describe", "tell", "about", "does",
]);

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function keywords(s: string): string[] {
  return normalize(s)
    .split(" ")
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w));
}

// Return the "top" questions from the knowledge base: short, high-frequency,
// covering different topic areas, so users get genuinely useful chips that all
// exist in ai-topics.json.
export async function GET(_req: NextRequest) {
  const filePath = join(process.cwd(), "data", "ai-topics.json");
  const raw = readFileSync(filePath, "utf-8");
  const data: QATopic[] = JSON.parse(raw);

  const all = data.flatMap((t) =>
    t.questions.map((q) => ({ topic: t.name, question: q.question }))
  );

  // Keyword frequency across the whole knowledge base
  const keywordFreq: Record<string, number> = {};
  for (const item of all) {
    for (const k of keywords(item.question)) {
      keywordFreq[k] = (keywordFreq[k] || 0) + 1;
    }
  }

  // Greedy selection: pick the best question each round, then exclude its
  // near-duplicates and penalize its topic so we get 4 varied topics.
  const picked: typeof all = [];
  const seenNorm = new Set<string>();
  const pickedTopics = new Set<string>();

  for (let round = 0; round < 4; round++) {
    let best: (typeof all)[number] & { score: number } | null = null;
    for (const item of all) {
      const n = normalize(item.question).slice(0, 40);
      if (seenNorm.has(n)) continue;
      const nearDup = picked.some(
        (p) =>
          normalize(p.question).includes(n) ||
          n.includes(normalize(p.question).slice(0, 25))
      );
      if (nearDup) continue;

      const freq = [...new Set(keywords(item.question))].reduce(
        (sum, k) => sum + Math.log1p(keywordFreq[k] || 1),
        0
      );
      // Prefer short, punchy questions for chips
      const lengthPenalty = Math.max(0, item.question.length - 40) / 15;
      // Diversity: reward topics not yet picked
      const diversity = pickedTopics.has(item.topic) ? 0 : 10;
      const score = freq + diversity - lengthPenalty;

      if (!best || score > best.score) best = { ...item, score };
    }
    if (!best) break;
    seenNorm.add(normalize(best.question).slice(0, 40));
    pickedTopics.add(best.topic);
    picked.push(best);
  }

  return Response.json({ suggestions: picked.map((p) => p.question) });
}
