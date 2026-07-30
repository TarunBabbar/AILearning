import { NextRequest } from "next/server";
import { getEmbedding } from "@/lib/embeddings";
import { chatCompletion } from "@/lib/openrouter";
import { createPineconeStore } from "@/lib/rag/pinecone-store";

export async function POST(req: NextRequest) {
  try {
    const { question, namespace = "default", model, systemMessage } = await req.json();

    if (!question) {
      return new Response(JSON.stringify({ error: "Question required" }), { status: 400 });
    }

    const store = createPineconeStore(namespace);
    const embedding = await getEmbedding(question);
    const results = await store.query(embedding, 5);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: unknown) => {
          controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
        };

        // Send sources first
        const sources = results.map((r) => ({
          source: (r.metadata.source as string) || "unknown",
          score: r.score,
        }));
        send({ type: "sources", content: sources });

        // If no results, send a message and done
        if (results.length === 0) {
          send({ type: "chunk", content: "No relevant content found in the knowledge base." });
          send({ type: "done" });
          controller.close();
          return;
        }

        const context = results
          .map((r) => `[Source: ${r.metadata.source || "unknown"}]\n${r.text}`)
          .join("\n\n");

        const sysMsg =
          systemMessage ||
          `You are a helpful QA assistant. Answer questions based ONLY on the provided context below. If the context doesn't contain enough information to answer, say so clearly. Do NOT cite source names or chunk numbers inline.

Context:
${context}`;

        try {
          const answer = await chatCompletion(
            [
              { role: "system", content: sysMsg },
              { role: "user", content: question },
            ],
            model
          );

          // Stream the answer in chunks
          const chunkSize = 20;
          for (let i = 0; i < answer.length; i += chunkSize) {
            send({ type: "chunk", content: answer.slice(i, i + chunkSize) });
          }
        } catch (err) {
          send({ type: "chunk", content: "Sorry, I encountered an error processing your request." });
        }

        send({ type: "done" });
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500 }
    );
  }
}
