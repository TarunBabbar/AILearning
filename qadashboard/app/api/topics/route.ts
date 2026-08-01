import { NextRequest } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

export async function GET(_req: NextRequest) {
  const filePath = join(process.cwd(), "data", "ai-topics.json");
  const raw = readFileSync(filePath, "utf-8");
  const data: { name: string; questions: { question: string; answer: string; source: string }[] }[] = JSON.parse(raw);

  const topics = data.map((t) => ({
    name: t.name,
    count: t.questions.length,
    questions: t.questions.map((q, i) => ({
      id: `${t.name}-${i}`,
      question: q.question,
      answer: q.answer,
      source: q.source,
    })),
  }));

  return Response.json({ topics });
}
