import { ChromaClient } from "chromadb";
import { v4 as uuidv4 } from "uuid";
import { getConfig } from "../config";
import type { ChunkData, IVectorStore, QueryResult } from "./vector-store";

const COLLECTION_NAME = "qa_documents";

export class ChromaStore implements IVectorStore {
  private client: ChromaClient;
  private collection: any = null;

  constructor() {
    const config = getConfig();
    this.client = new ChromaClient({
      path: config.chromaUrl,
    });
  }

  private async getCollection() {
    // Always fetch collection by name — don't cache the UUID
    try {
      this.collection = await this.client.getCollection({ name: COLLECTION_NAME });
    } catch {
      this.collection = await this.client.createCollection({ name: COLLECTION_NAME });
    }
    return this.collection;
  }

  async reset(): Promise<void> {
    try {
      await this.client.deleteCollection({ name: COLLECTION_NAME });
    } catch {
      // collection didn't exist
    }
    this.collection = null;
  }

  async upsert(chunks: ChunkData[]): Promise<void> {
    const collection = await this.getCollection();
    const ids = chunks.map((c) => c.id);
    const embeddings = chunks.map((c) => c.embedding);
    const metadatas = chunks.map((c) => c.metadata);
    const documents = chunks.map((c) => c.text);

    // ChromaDB add in batches to avoid large payloads
    const batchSize = 20;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batchEnd = Math.min(i + batchSize, chunks.length);
      await collection.add({
        ids: ids.slice(i, batchEnd),
        embeddings: embeddings.slice(i, batchEnd),
        metadatas: metadatas.slice(i, batchEnd),
        documents: documents.slice(i, batchEnd),
      });
    }
  }

  async query(embedding: number[], topK: number): Promise<QueryResult[]> {
    const collection = await this.getCollection();
    const results = await collection.query({
      queryEmbeddings: [embedding],
      nResults: topK,
    });

    const items: QueryResult[] = [];
    if (results.documents && results.documents[0]) {
      for (let i = 0; i < results.documents[0].length; i++) {
        items.push({
          text: results.documents[0][i],
          metadata: results.metadatas?.[0]?.[i] || {},
          score: results.distances?.[0]?.[i]
            ? 1 - results.distances[0][i]
            : 0,
        });
      }
    }
    return items;
  }

  async listDocuments(): Promise<string[]> {
    const collection = await this.getCollection();
    const all = await collection.get();
    const docNames = new Set<string>();
    for (const meta of all.metadatas || []) {
      if (meta?.source) docNames.add(meta.source);
    }
    return Array.from(docNames).sort();
  }

  async deleteDocument(documentName: string): Promise<void> {
    const collection = await this.getCollection();
    const all = await collection.get();
    const idsToDelete: string[] = [];
    for (let i = 0; i < (all.metadatas?.length || 0); i++) {
      if (all.metadatas?.[i]?.source === documentName) {
        idsToDelete.push(all.ids[i]);
      }
    }
    if (idsToDelete.length > 0) {
      await collection.delete({ ids: idsToDelete });
    }
  }

  async getDocumentCount(): Promise<number> {
    const docs = await this.listDocuments();
    return docs.length;
  }

  async getChunkCount(): Promise<number> {
    const collection = await this.getCollection();
    return (await collection.count()) || 0;
  }

  async getTopics(): Promise<string[]> {
    const collection = await this.getCollection();
    const all = await collection.get();
    const topics = new Set<string>();
    for (const meta of all.metadatas || []) {
      if (meta?.topic) topics.add(meta.topic as string);
    }
    return Array.from(topics).sort();
  }

  async getQuestionsByTopic(
    topic: string
  ): Promise<{ question: string; answer: string; source: string }[]> {
    const collection = await this.getCollection();
    const results = await collection.get({
      where: { topic },
    });

    const items: { question: string; answer: string; source: string }[] = [];
    for (let i = 0; i < (results.metadatas?.length || 0); i++) {
      const doc = results.documents?.[i];
      const meta = results.metadatas?.[i] || {};
      if (!doc) continue;
      items.push({
        question: (meta.question as string) || doc.substring(0, 200),
        answer: doc,
        source: (meta.source as string) || "",
      });
    }
    return items;
  }
}
