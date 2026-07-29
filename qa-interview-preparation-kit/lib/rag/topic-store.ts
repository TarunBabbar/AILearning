/**
 * Storage abstraction for AI-organized topics.
 * Static import at build time (works on Vercel), file write for local saves.
 */
import path from "path";
import fs from "fs";

// Static import — bundled by Next.js at build time, available on Vercel
import staticTopics from "../../data/ai-topics.json";

type TopicData = { name: string; questions: { question: string; answer: string; source: string }[] }[];

export async function loadTopics(): Promise<TopicData | null> {
  // File first — catches locally re-classified data
  try {
    const filePath = path.resolve(process.cwd(), "data", "ai-topics.json");
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch {}

  // Static import fallback — works on Vercel (bundled at build time)
  if (Array.isArray(staticTopics) && staticTopics.length > 0) return staticTopics as TopicData;

  return null;
}

export async function saveTopics(data: TopicData): Promise<void> {
  // Write to data/ — git-tracked, committed for Vercel
  try {
    const filePath = path.resolve(process.cwd(), "data", "ai-topics.json");
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch {}
}

export async function clearTopics(): Promise<void> {
  try {
    const filePath = path.resolve(process.cwd(), "data", "ai-topics.json");
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {}
}
