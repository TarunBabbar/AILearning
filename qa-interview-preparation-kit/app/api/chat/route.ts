import { NextRequest, NextResponse } from "next/server";
import { getOpenRouterClient } from "../../../lib/openrouter";
import { getEmbedding } from "../../../lib/rag/embeddings";
import { getVectorStore } from "../../../lib/rag/vector-store-factory";
import { getConfig } from "../../../lib/config";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { question } = await req.json();

  if (!question || typeof question !== "string") {
    return NextResponse.json({ error: "Question is required" }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const config = getConfig();
        const store = await getVectorStore();

        // 1. Embed question
        const embedding = await getEmbedding(question);

        // 2. Retrieve top chunks
        const results = await store.query(embedding, 5);

        if (results.length === 0) {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: "answer",
                content:
                  "No relevant info found. Upload QA PDFs first.",
              }) + "\n"
            )
          );
          controller.close();
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

        // 4. Send sources
        controller.enqueue(
          encoder.encode(JSON.stringify({ type: "sources", content: sources }) + "\n")
        );

        // 5. Stream LLM response
        const client = getOpenRouterClient();
        const chatStream = await client.chat.completions.create({
          model: config.llmModel,
          messages: [
            {
              role: "system",
              content:
                "You are a QA interview prep assistant. Answer ONLY from provided context. Be thorough. When citing, use the actual source filename shown in brackets like [Source 1: filename.pdf]. Never say just 'Source 1' — include the filename.",
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

        for await (const chunk of chatStream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            controller.enqueue(
              encoder.encode(
                JSON.stringify({ type: "chunk", content }) + "\n"
              )
            );
          }
        }

        controller.enqueue(
          encoder.encode(JSON.stringify({ type: "done" }) + "\n")
        );
      } catch (err: any) {
        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              type: "error",
              content: err.message || "Something went wrong",
            }) + "\n"
          )
        );
      }
      controller.close();
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
    },
  });
}
