import { readFileSync } from "fs";
import { join } from "path";

type QAItem = { question: string; answer: string; source: string };
type QATopic = { name: string; questions: QAItem[] };
type Match = { score: number; question: string; source: string; answerLen: number };

const filePath = join(process.cwd(), "data", "ai-topics.json");
const raw = readFileSync(filePath, "utf-8");
const data: QATopic[] = JSON.parse(raw);

const question = "java + selenium - can you help me understanding this?";
const qLower = question.toLowerCase();
const matches: Match[] = [];

for (const topic of data) {
  for (const q of topic.questions) {
    const qq: string = q.question.toLowerCase();
    const keywords: string[] = qq.split(/\W+/).filter((w: string) => w.length > 3);
    const hitCount: number = keywords.filter((k: string) => qLower.includes(k)).length;
    const ratio: number = hitCount / Math.max(keywords.length, 1);
    const substrHit: number = qLower.length > 8 && qq.includes(qLower.slice(0, 12)) ? 0.3 : 0;
    const qWords: string[] = qLower.split(/\W+/).filter((w: string) => w.length > 3);
    const qWordHits: number = qWords.filter((w: string) => qq.includes(w)).length;
    const qRatio: number = qWordHits / Math.max(qWords.length, 1);
    const score: number = Math.max(ratio + substrHit, qRatio);
    if (score > 0.15) {
      matches.push({ score, question: q.question.slice(0, 80), source: q.source, answerLen: q.answer.length });
    }
  }
}

matches.sort((a, b) => b.score - a.score);
console.log("Total matches:", matches.length);
matches.slice(0, 10).forEach((m) => console.log(`  ${m.score.toFixed(2)} | ${m.question} | ${m.source} | ${m.answerLen}ch`));
