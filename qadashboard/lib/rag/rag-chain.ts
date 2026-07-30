import { getEmbedding } from "@/lib/embeddings";
import { chatCompletion } from "@/lib/openrouter";
import { createPineconeStore } from "./pinecone-store";
import type { VectorStore } from "./vector-store";

const stores = new Map<string, VectorStore>();

function getStore(namespace: string): VectorStore {
  if (!stores.has(namespace)) {
    stores.set(namespace, createPineconeStore(namespace));
  }
  return stores.get(namespace)!;
}

export interface RAGResult {
  answer: string;
  sources: { source: string; score: number; text: string }[];
}

export async function answerQuestion(
  question: string,
  namespace: string = "default",
  topK: number = 5,
  model?: string
): Promise<RAGResult> {
  const store = getStore(namespace);

  const embedding = await getEmbedding(question);
  const results = await store.query(embedding, topK);

  if (results.length === 0) {
    return { answer: "No relevant content found in the knowledge base.", sources: [] };
  }

  const context = results
    .map((r) => `[Source: ${r.metadata.source || "unknown"}]\n${r.text}`)
    .join("\n\n");

  const systemPrompt = `You are a helpful QA assistant. Answer questions based ONLY on the provided context below. If the context doesn't contain enough information to answer, say so clearly. Do NOT cite source names or chunk numbers inline. Keep answers thorough and well-structured.

Context:
${context}`;

  const answer = await chatCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: question },
    ],
    model
  );

  const sources = results.map((r) => ({
    source: (r.metadata.source as string) || "unknown",
    score: r.score,
    text: r.text.slice(0, 200),
  }));

  return { answer, sources };
}

export function chunkText(text: string, chunkSize = 1536, overlap = 200): string[] {
  if (!text || !text.trim()) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap;
  }
  return chunks.filter((c) => c.trim().length > 0);
}
