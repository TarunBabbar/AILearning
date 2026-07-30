export interface ChunkData {
  id: string;
  text: string;
  embedding: number[];
  metadata: Record<string, unknown>;
}

export interface QueryResult {
  id: string;
  text: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface DocMetadata {
  id: string;
  name: string;
  chunkCount: number;
}

export interface VectorStore {
  namespace: string;
  upsert(chunks: ChunkData[]): Promise<void>;
  query(embedding: number[], topK: number): Promise<QueryResult[]>;
  listDocuments(): Promise<DocMetadata[]>;
  deleteDocument(docId: string): Promise<void>;
  getDocumentCount(): Promise<number>;
}
