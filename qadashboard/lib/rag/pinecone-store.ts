import { Pinecone } from "@pinecone-database/pinecone";
import { getConfig } from "@/lib/config";
import type { ChunkData, QueryResult, DocMetadata, VectorStore } from "./vector-store";

let pineconeClient: Pinecone | null = null;

function getClient(): Pinecone {
  if (!pineconeClient) {
    const cfg = getConfig();
    pineconeClient = new Pinecone({ apiKey: cfg.pineconeApiKey });
  }
  return pineconeClient;
}

async function getIndex() {
  const cfg = getConfig();
  return getClient().index(cfg.pineconeIndexName);
}

export function createPineconeStore(ns: string = "default"): VectorStore {
  return {
    namespace: ns,

    async upsert(chunks: ChunkData[]): Promise<void> {
      const index = await getIndex();
      const batchSize = 100;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        await index.namespace(ns).upsert({
          records: batch.map((c) => ({
            id: c.id,
            values: c.embedding,
            metadata: { ...c.metadata, text: c.text } as Record<string, string | number | boolean | string[]>,
          }))
        });
      }
    },

    async query(embedding: number[], topK: number): Promise<QueryResult[]> {
      const index = await getIndex();
      const res = await index.namespace(ns).query({
        vector: embedding,
        topK,
        includeMetadata: true,
      });
      return res.matches.map((m) => ({
        id: m.id,
        text: (m.metadata?.text as string) || "",
        score: m.score || 0,
        metadata: m.metadata || {},
      }));
    },

    async listDocuments(): Promise<DocMetadata[]> {
      // Pinecone doesn't support listing distinct metadata values natively
      // Return empty — we use the DB for document tracking
      return [];
    },

    async deleteDocument(docId: string): Promise<void> {
      const index = await getIndex();
      await index.namespace(ns).deleteMany({
        filter: { source: { $eq: docId } } as object,
      });
    },

    async getDocumentCount(): Promise<number> {
      return 0;
    },
  };
}
