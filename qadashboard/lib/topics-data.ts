import { readFileSync } from "fs";
import { join } from "path";

export type TopicQuestion = {
  question: string;
  answer: string;
  source: string;
};

export type TopicRecord = {
  name: string;
  questions: TopicQuestion[];
};

type TopicsCache = {
  at: number;
  topics: TopicRecord[];
  qaPairs: number;
};

let cache: TopicsCache | null = null;
const TTL_MS = 5 * 60_000;

function loadTopics(): TopicsCache {
  if (cache && Date.now() - cache.at < TTL_MS) return cache;
  const filePath = join(process.cwd(), "data", "ai-topics.json");
  const raw = readFileSync(filePath, "utf-8");
  const topics: TopicRecord[] = JSON.parse(raw);
  const qaPairs = topics.reduce((sum, t) => sum + t.questions.length, 0);
  cache = { at: Date.now(), topics, qaPairs };
  return cache;
}

export function getTopicsSummary(): { name: string; count: number }[] {
  return loadTopics().topics.map((t) => ({
    name: t.name,
    count: t.questions.length,
  }));
}

/** Full cached topic list (chat retrieval reuses this instead of re-reading the file). */
export function getTopicsData(): TopicRecord[] {
  return loadTopics().topics;
}

export function getTopicDetail(name: string): TopicRecord | null {
  const found = loadTopics().topics.find(
    (t) => t.name.toLowerCase() === name.toLowerCase()
  );
  return found || null;
}

export function getTopicsStats(): { topics: number; qaPairs: number } {
  const data = loadTopics();
  return { topics: data.topics.length, qaPairs: data.qaPairs };
}
