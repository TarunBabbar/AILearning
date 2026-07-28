import { getOpenRouterClient } from "../openrouter";
import { getConfig } from "../config";
import { getEmbedding } from "./embeddings";
import { getVectorStore } from "./vector-store-factory";

export interface RAGResult {
  answer: string;
  sources: { text: string; source: string }[];
}

export async function askQuestion(question: string): Promise<RAGResult> {
  const config = getConfig();
  const store = await getVectorStore();

  // 1. Embed the question
  const embedding = await getEmbedding(question);

  // 2. Retrieve top 5 relevant chunks
  const results = await store.query(embedding, 5);

  if (results.length === 0) {
    return {
      answer:
        "I couldn't find any relevant information in the indexed documents. Try uploading some QA interview PDFs first.",
      sources: [],
    };
  }

  // 3. Build context from retrieved chunks
  const context = results
    .map(
      (r, i) =>
        `[Source ${i + 1}: ${r.metadata.source || "Unknown"}]\n${r.text}`
    )
    .join("\n\n");

  const sources = results.map((r) => ({
    text: r.text.substring(0, 200),
    source: (r.metadata.source as string) || "Unknown",
  }));

  // 4. Call LLM with RAG prompt
  const client = getOpenRouterClient();

  const completion = await client.chat.completions.create({
    model: config.llmModel,
    messages: [
      {
        role: "system",
        content: `You are a QA interview preparation assistant. Your job is to help the user find answers about software testing, QA engineering, and related topics.

Given the context from QA interview documents, answer the user's question thoroughly and accurately.

Guidelines:
- Base your answer ONLY on the provided context.
- If the context doesn't contain enough information, say so honestly.
- Include specific details, examples, and references to source documents when available.
- Format your answer in clear paragraphs with bullet points if helpful.
- At the end of your answer, list which source document(s) you used.`,
      },
      {
        role: "user",
        content: `Context from QA interview documents:\n\n${context}\n\nQuestion: ${question}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 1024,
  });

  const answer =
    completion.choices[0]?.message?.content ||
    "Sorry, I couldn't generate an answer.";

  return { answer, sources };
}

export async function* askQuestionStream(
  question: string
): AsyncGenerator<string> {
  const config = getConfig();
  const store = await getVectorStore();

  // 1. Embed the question
  const embedding = await getEmbedding(question);

  // 2. Retrieve top 5 relevant chunks
  const results = await store.query(embedding, 5);

  if (results.length === 0) {
    yield JSON.stringify({
      type: "answer",
      content:
        "I couldn't find any relevant information in the indexed documents. Try uploading some QA interview PDFs first.",
    });
    return;
  }

  // 3. Build context
  const context = results
    .map(
      (r, i) =>
        `[Source ${i + 1}: ${r.metadata.source || "Unknown"}]\n${r.text}`
    )
    .join("\n\n");

  const sources = results.map((r) => ({
    text: r.text.substring(0, 200),
    source: (r.metadata.source as string) || "Unknown",
  }));

  // Send sources first
  yield JSON.stringify({ type: "sources", content: sources });

  // 4. Stream the LLM response
  const client = getOpenRouterClient();
  const stream = await client.chat.completions.create({
    model: config.llmModel,
    messages: [
      {
        role: "system",
        content: `You are a QA interview preparation assistant. Answer based ONLY on the provided context. Be thorough and include source references.`,
      },
      {
        role: "user",
        content: `Context:\n\n${context}\n\nQuestion: ${question}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 1024,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || "";
    if (content) {
      yield JSON.stringify({ type: "chunk", content });
    }
  }

  yield JSON.stringify({ type: "done" });
}
