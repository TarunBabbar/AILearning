/**
 * Storage abstraction for AI-organized topics.
 * Uses Vercel KV REST API (via fetch) when available, falls back to local file storage.
 */
import path from "path";
import fs from "fs";
import { getConfig } from "../config";

type TopicData = { name: string; questions: { question: string; answer: string; source: string }[] }[];

const KV_KEY = "ai_topics";

const KV_BASE = process.env.KV_REST_API_URL || "";
const KV_TOKEN = process.env.KV_REST_API_TOKEN || "";

async function kvGet(key: string): Promise<any> {
  if (!KV_BASE || !KV_TOKEN) return null;
  try {
    const res = await fetch(`${KV_BASE}/get/${key}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.result;
  } catch {
    return null;
  }
}

async function kvSet(key: string, value: any): Promise<void> {
  if (!KV_BASE || !KV_TOKEN) return;
  try {
    await fetch(`${KV_BASE}/set/${key}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
  } catch {}
}

async function kvDel(key: string): Promise<void> {
  if (!KV_BASE || !KV_TOKEN) return;
  try {
    await fetch(`${KV_BASE}/del/${key}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
    });
  } catch {}
}

export async function loadTopics(): Promise<TopicData | null> {
  const kvData = await kvGet(KV_KEY);
  if (kvData) return kvData as TopicData;

  try {
    const config = getConfig();
    const filePath = path.resolve(config.dataPath, "ai-topics.json");
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

export async function saveTopics(data: TopicData): Promise<void> {
  await kvSet(KV_KEY, data);

  try {
    const config = getConfig();
    const filePath = path.resolve(config.dataPath, "ai-topics.json");
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch {}
}

export async function clearTopics(): Promise<void> {
  await kvDel(KV_KEY);

  try {
    const config = getConfig();
    const filePath = path.resolve(config.dataPath, "ai-topics.json");
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {}
}
