import fs from "fs";
import path from "path";
import { getConfig } from "../config";
import type { ChunkData, IVectorStore, QueryResult } from "./vector-store";

const DATA_FILE = "vectors.ndjson";

interface StoreChunk {
  id: string;
  text: string;
  embedding: number[];
  metadata: Record<string, any>;
}

export class LocalStore implements IVectorStore {
  private dbPath: string;
  private data: StoreChunk[] = [];

  constructor() {
    const config = getConfig();
    this.dbPath = path.resolve(config.dataPath, DATA_FILE);
    this.load();
  }

  private load() {
    try {
      if (!fs.existsSync(this.dbPath)) return;
      const raw = fs.readFileSync(this.dbPath, "utf-8");
      this.data = raw
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line));
    } catch {
      this.data = [];
    }
  }

  private save() {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const lines = this.data.map((c) => JSON.stringify(c)).join("\n");
    fs.writeFileSync(this.dbPath, lines + "\n", "utf-8");
  }

  async upsert(chunks: ChunkData[]): Promise<void> {
    this.data.push(
      ...chunks.map((c) => ({
        id: c.id,
        text: c.text,
        embedding: c.embedding,
        metadata: c.metadata,
      }))
    );
    this.save();
  }

  async query(embedding: number[], topK: number): Promise<QueryResult[]> {
    const scored = this.data.map((c) => ({
      text: c.text,
      metadata: c.metadata,
      score: cosineSimilarity(embedding, c.embedding),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  async listDocuments(): Promise<string[]> {
    const names = new Set<string>();
    for (const c of this.data) {
      if (c.metadata.source) names.add(c.metadata.source as string);
    }
    return Array.from(names).sort();
  }

  async deleteDocument(documentName: string): Promise<void> {
    this.data = this.data.filter(
      (c) => c.metadata.source !== documentName
    );
    this.save();
  }

  async getDocumentCount(): Promise<number> {
    return (await this.listDocuments()).length;
  }

  async getChunkCount(): Promise<number> {
    return this.data.length;
  }

  async getTopics(): Promise<string[]> {
    const topics = new Set<string>();
    for (const c of this.data) {
      if (c.metadata.topic) topics.add(c.metadata.topic as string);
    }
    return Array.from(topics).sort();
  }

  async getQuestionsByTopic(
    topic: string
  ): Promise<{ question: string; answer: string; source: string }[]> {
    const filtered = this.data.filter(
      (c) => c.metadata.topic === topic
    );
    return filtered.map((c) => ({
      question: c.text.substring(0, 200),
      answer: c.text,
      source: (c.metadata.source as string) || "",
    }));
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0,
    magA = 0,
    magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}
