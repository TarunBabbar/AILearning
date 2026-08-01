import { readFileSync } from "fs";
import { join } from "path";

export async function GET() {
  const filePath = join(process.cwd(), "data", "ai-topics.json");
  let qaPairs = 0;
  let topics = 0;

  try {
    const raw = readFileSync(filePath, "utf-8");
    const data: { name: string; questions: unknown[] }[] = JSON.parse(raw);
    topics = data.length;
    qaPairs = data.reduce((sum, t) => sum + t.questions.length, 0);
  } catch {
    // file not found — return 0
  }

  return Response.json({
    documents: 0,
    qaPairs,
    jobs: 0,
    topics,
    projects: 0,
  });
}
