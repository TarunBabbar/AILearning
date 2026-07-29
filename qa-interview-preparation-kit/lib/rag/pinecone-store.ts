import fs from "fs";
import path from "path";
import { Pinecone } from "@pinecone-database/pinecone";
import { v4 as uuidv4 } from "uuid";
import { getConfig } from "../config";
import type { ChunkData, IVectorStore, QueryResult } from "./vector-store";

const INDEX_FILE = "pinecone-index.json";

export class PineconeStore implements IVectorStore {
  private client: Pinecone;
  private index: any = null;
  private metaPath: string;

  // In-memory metadata index (not in Pinecone — serverless can't scan)
  private documents: Set<string> = new Set();
  private topics: Map<string, number> = new Map(); // topic → count

  constructor() {
    const config = getConfig();
    this.client = new Pinecone({
      apiKey: config.pineconeApiKey,
    });
    this.metaPath = path.resolve(config.dataPath, INDEX_FILE);
    this.loadIndex();
  }

  private loadIndex() {
    try {
      if (fs.existsSync(this.metaPath)) {
        const raw = fs.readFileSync(this.metaPath, "utf-8");
        const data = JSON.parse(raw);
        this.documents = new Set(data.documents || []);
        this.topics = new Map(Object.entries(data.topics || {}));
      }
    } catch {
      // fall through — will lazily fetch from Pinecone
    }
  }

  /** Fetch documents and topics directly from Pinecone when local sidecar is unavailable (e.g. Vercel). */
  private async ensureMetadata() {
    // Only rebuild if empty and not already in progress
    if (this.documents.size > 0 || this.topics.size > 0) return;
    try {
      const index = await this.getIndex();
      const stats = await index.describeIndexStats();
      const totalRecords = stats.totalRecordCount || 0;
      if (totalRecords === 0) return;

      let paginationToken: string | null | undefined = undefined;
      do {
        const result = await index.listPaginated({ limit: 99, paginationToken });
        const ids = (result.vectors || []).map((v: any) => v.id);
        paginationToken = (result.pagination?.next as string | null | undefined) ?? undefined;

        if (ids.length === 0) break;
        const fetchResult = await index.fetch(ids);
        for (const vec of Object.values(fetchResult.records || {})) {
          const meta = (vec as any).metadata || {};
          if (meta.source) this.documents.add(meta.source as string);
          if (meta.topic) {
            const t = meta.topic as string;
            this.topics.set(t, (this.topics.get(t) || 0) + 1);
          }
        }
      } while (paginationToken);
    } catch {
      // Best-effort: if Pinecone query fails, return empty
    }
  }

  private saveIndex() {
    const dir = path.dirname(this.metaPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      this.metaPath,
      JSON.stringify({
        documents: Array.from(this.documents),
        topics: Object.fromEntries(this.topics),
      }),
      "utf-8"
    );
  }

  private async getIndex() {
    if (this.index) return this.index;
    const config = getConfig();
    this.index = this.client.index(config.pineconeIndexName);
    return this.index;
  }

  async reset(): Promise<void> {
    const config = getConfig();
    try {
      await this.client.index(config.pineconeIndexName).deleteAll();
    } catch {
      // index may not exist
    }
    this.documents = new Set();
    this.topics = new Map();
    this.saveIndex();
  }

  async upsert(chunks: ChunkData[]): Promise<void> {
    const index = await this.getIndex();
    const vectors = chunks.map((c) => ({
      id: c.id,
      values: c.embedding,
      metadata: {
        text: c.text,
        ...c.metadata,
      },
    }));

    // Update local metadata index
    for (const c of chunks) {
      if (c.metadata.source) this.documents.add(c.metadata.source as string);
      if (c.metadata.topic) {
        const topic = c.metadata.topic as string;
        this.topics.set(topic, (this.topics.get(topic) || 0) + 1);
      }
    }
    this.saveIndex();

    const batchSize = 100;
    for (let i = 0; i < vectors.length; i += batchSize) {
      await index.upsert(vectors.slice(i, i + batchSize));
    }
  }

  async query(embedding: number[], topK: number): Promise<QueryResult[]> {
    const index = await this.getIndex();
    const results = await index.query({
      vector: embedding,
      topK,
      includeMetadata: true,
    });

    return (results.matches || []).map((match: any) => ({
      text: match.metadata?.text || "",
      metadata: match.metadata || {},
      score: match.score || 0,
    }));
  }

  async listDocuments(): Promise<string[]> {
    await this.ensureMetadata();
    return Array.from(this.documents).sort();
  }

  async deleteDocument(documentName: string): Promise<void> {
    const index = await this.getIndex();
    // Pinecone supports delete by metadata filter
    await index.deleteMany({ source: documentName });
    this.documents.delete(documentName);
    this.saveIndex();
  }

  async getDocumentCount(): Promise<number> {
    await this.ensureMetadata();
    return this.documents.size;
  }

  async getChunkCount(): Promise<number> {
    // Try Pinecone stats first, fall back to local estimate
    try {
      const index = await this.getIndex();
      const stats = await index.describeIndexStats();
      return stats.totalRecordCount || 0;
    } catch {
      return Array.from(this.topics.values()).reduce((a, b) => a + b, 0);
    }
  }

  async getTopics(): Promise<string[]> {
    await this.ensureMetadata();
    return Array.from(this.topics.keys()).sort();
  }

  async getQuestionsByTopic(
    topic: string
  ): Promise<{ question: string; answer: string; source: string }[]> {
    const config = getConfig();
    const index = await this.getIndex();
    const results = await index.query({
      vector: new Array(config.embeddingDimensions).fill(0),
      topK: 100,
      includeMetadata: true,
      filter: { topic: { $eq: topic } },
    });

    return (results.matches || []).map((match: any) => ({
      question: (match.metadata?.question || match.metadata?.text || "").substring(0, 200),
      answer: match.metadata?.text || "",
      source: match.metadata?.source || "",
    }));
  }
}
