import { NextRequest } from "next/server";
import { chatCompletionStream } from "@/lib/openrouter";
import { readFileSync } from "fs";
import { join } from "path";

type QAItem = { question: string; answer: string; source: string };
type QATopic = { name: string; questions: QAItem[] };

// Fetch Q&A pairs from ai-topics.json and score how well each stored
// question matches the user's question (keyword overlap + substring boost).
function findMatches(question: string, data: QATopic[]): { text: string; score: number; source: string }[] {
  const qLower = question.toLowerCase();
  const matches: { text: string; score: number; source: string }[] = [];

  for (const topic of data) {
    for (const q of topic.questions) {
      const qq = q.question.toLowerCase();
      // Keyword overlap scoring
      const keywords = qq.split(/\W+/).filter((w) => w.length > 3);
      const hitCount = keywords.filter((k) => qLower.includes(k)).length;
      const ratio = hitCount / Math.max(keywords.length, 1);
      // Exact substring boost
      const substrHit = qLower.length > 8 && qq.includes(qLower.slice(0, 12)) ? 0.3 : 0;
      // Question-word match boost
      const qWords = qLower.split(/\W+/).filter((w) => w.length > 3);
      const qWordHits = qWords.filter((w) => qq.includes(w)).length;
      const qRatio = qWordHits / Math.max(qWords.length, 1);

      const score = Math.max(ratio + substrHit, qRatio);
      if (score > 0.15) {
        matches.push({ text: `Q: ${q.question}\nA: ${q.answer}`, score, source: q.source });
      }
    }
  }

  return matches;
}

// Keep the best-scoring matches while collapsing near-duplicate Q&A entries
// (same source file + near-identical question text) down to one.
function dedupeMatches(matches: { text: string; score: number; source: string }[]): { text: string; score: number; source: string }[] {
  const seenQ = new Set<string>();
  const seenSource = new Set<string>();
  return matches
    .sort((a, b) => b.score - a.score)
    .filter((m) => {
      const qPart = m.text.split("\nA:")[0].replace(/\W+/g, " ").trim().toLowerCase();
      const qKey = `${m.source}|${qPart.slice(0, 60)}`;
      if (seenQ.has(qKey)) return false;
      seenQ.add(qKey);
      const srcKey = m.source.replace(/[ ()\[\]]/g, "");
      if (seenSource.has(srcKey)) return false;
      seenSource.add(srcKey);
      return true;
    });
}

export async function POST(req: NextRequest) {
  try {
    const { question, namespace, model, systemMessage } = await req.json();

    if (!question) {
      return new Response(JSON.stringify({ error: "Question required" }), { status: 400 });
    }

    // Read Q&A pairs from ai-topics.json and find the best matches
    const filePath = join(process.cwd(), "data", "ai-topics.json");
    const raw = readFileSync(filePath, "utf-8");
    const data: QATopic[] = JSON.parse(raw);

    const matches = dedupeMatches(findMatches(question, data));
    const results = matches.slice(0, 3);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: unknown) => {
          controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
        };

        // Send sources first
        const sources = results.map((r) => ({
          source: r.source || "unknown",
          score: Math.min(0.99, r.score),
        }));
        send({ type: "sources", content: sources });

        if (results.length === 0) {
          send({
            type: "chunk",
            content:
              "I couldn't find a matching Q&A in the knowledge base. Try rephrasing your question or ask about a QA topic like testing, automation, API, or Agile.",
          });
          send({ type: "done" });
          controller.close();
          return;
        }

        // Ground the LLM in the best matching stored Q&A pairs so the answer
        // is accurate, then let it restructure/clean up the response.
        const context = results
          .map((r) => r.text)
          .join("\n\n---\n\n");

        const sysMsg =
          systemMessage ||
          `You are a senior QA interview coach. The user asked a question, and below are the best-matching Q&A pairs retrieved from the knowledge base.

Use them as your source of truth. If the context contains the information needed, answer the question thoroughly and clearly, in a well-structured format (headings, bullet points, code blocks) that a QA candidate would find easy to understand.

Rules:
- Answer ONLY from the provided context. Do NOT invent facts not present in it.
- Remove duplicated, repeated, or garbled text. Fix obvious spelling errors from the source.
- Do not mention "the context", "the knowledge base", "source", or quote the Q&A verbatim.
- If the context does not contain enough information, say so honestly and suggest what to study.

Context:
${context}`;

        try {
          // Stream the LLM answer in chunks
          const chunkSize = 40;
          let buffer = "";
          for await (const piece of chatCompletionStream(
            [
              { role: "system", content: sysMsg },
              { role: "user", content: question },
            ],
            model
          )) {
            buffer += piece;
            while (buffer.length >= chunkSize) {
              send({ type: "chunk", content: buffer.slice(0, chunkSize) });
              buffer = buffer.slice(chunkSize);
            }
          }
          if (buffer.length > 0) {
            send({ type: "chunk", content: buffer });
          }
        } catch (err) {
          console.error("LLM error:", err);
          send({
            type: "chunk",
            content:
              "Sorry, I encountered an error generating the answer. Please try again or switch the model from the dropdown.",
          });
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
