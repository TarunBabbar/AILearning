import { readFileSync } from "fs";
import { join } from "path";

const filePath = join(process.cwd(), "data", "ai-topics.json");
const raw = readFileSync(filePath, "utf-8");
const data = JSON.parse(raw);

const question = "java + selenium - can you help me understanding this?";
const qLower = question.toLowerCase();
const matches = [];

for (const topic of data) {
  for (const q of topic.questions) {
    const qq = q.question.toLowerCase();
    const keywords = qq.split(/\W+/).filter((w) => w.length > 3);
    const hitCount = keywords.filter((k) => qLower.includes(k)).length;
    const ratio = hitCount / Math.max(keywords.length, 1);
    const substrHit = qLower.length > 8 && qq.includes(qLower.slice(0, 12)) ? 0.3 : 0;
    const qWords = qLower.split(/\W+/).filter((w) => w.length > 3);
    const qWordHits = qWords.filter((w) => qq.includes(w)).length;
    const qRatio = qWordHits / Math.max(qWords.length, 1);
    const score = Math.max(ratio + substrHit, qRatio);
    if (score > 0.15) {
      matches.push({ score: score.toFixed(2), question: q.question.slice(0, 80), source: q.source, answerLen: q.answer.length });
    }
  }
}

matches.sort((a, b) => b.score - a.score);
console.log("Total matches:", matches.length);
matches.slice(0, 10).forEach((m) => console.log(`  ${m.score} | ${m.question} | ${m.source} | ${m.answerLen}ch`));
