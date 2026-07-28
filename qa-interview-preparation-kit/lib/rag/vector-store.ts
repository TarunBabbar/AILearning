export interface ChunkData {
  id: string;
  text: string;
  embedding: number[];
  metadata: Record<string, any>;
}

export interface QAPairData {
  question: string;
  answer: string;
  source: string;
  topic: string;
}

export interface QueryResult {
  text: string;
  metadata: Record<string, any>;
  score: number;
}

export interface IVectorStore {
  upsert(chunks: ChunkData[]): Promise<void>;
  query(embedding: number[], topK: number): Promise<QueryResult[]>;
  listDocuments(): Promise<string[]>;
  deleteDocument(documentName: string): Promise<void>;
  getDocumentCount(): Promise<number>;
  getChunkCount(): Promise<number>;
  getTopics(): Promise<string[]>;
  getQuestionsByTopic(topic: string): Promise<{ question: string; answer: string; source: string }[]>;
}
