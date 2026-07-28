import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { parsePDF } from "../../../lib/rag/document-loader";
import { extractQAPairs } from "../../../lib/rag/qa-extractor";
import { getEmbeddingsBatch } from "../../../lib/rag/embeddings";
import { getVectorStore } from "../../../lib/rag/vector-store-factory";

export const maxDuration = 120;
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.name.endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Only PDF files are accepted" },
        { status: 400 }
      );
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Parse PDF
    const parsed = await parsePDF(buffer, file.name);

    // Extract Q&A pairs via LLM
    const qaPairs = await extractQAPairs(parsed.text);

    if (qaPairs.length === 0) {
      return NextResponse.json(
        { error: "No Q&A pairs could be extracted from this PDF" },
        { status: 400 }
      );
    }

    // Guess topic from filename
    const topicGuess = guessTopic(file.name);

    // Each Q&A pair = one chunk (answer = text, question = metadata)
    const chunks = qaPairs.map((qa) => ({
      text: qa.answer,
      metadata: {
        source: file.name,
        type: "qa-document",
        question: qa.question,
        topic: topicGuess,
      },
    }));

    // Generate embeddings
    const texts = chunks.map((c) => c.text);
    const embeddings = await getEmbeddingsBatch(texts);

    // Prepare for vector store
    const store = await getVectorStore();
    const data = chunks.map((chunk, i) => ({
      id: uuidv4(),
      text: chunk.text,
      embedding: embeddings[i],
      metadata: {
        ...chunk.metadata,
        chunkIndex: i,
        totalChunks: chunks.length,
      },
    }));

    await store.upsert(data);

    return NextResponse.json({
      success: true,
      document: file.name,
      chunks: chunks.length,
      pages: parsed.metadata.pageCount,
    });
  } catch (err: any) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to process upload" },
      { status: 500 }
    );
  }
}

function guessTopic(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.includes("ai") || lower.includes("artificial")) return "AI & Testing";
  if (lower.includes("agile") || lower.includes("scrum")) return "Agile & Scrum";
  if (lower.includes("api")) return "API Testing";
  if (lower.includes("sql") || lower.includes("database")) return "Database & SQL";
  if (lower.includes("java")) return "Java";
  if (lower.includes("selenium") || lower.includes("testng")) return "Selenium & TestNG";
  if (lower.includes("playwright")) return "Playwright";
  if (lower.includes("bdd") || lower.includes("cucumber")) return "BDD & Cucumber";
  if (lower.includes("git")) return "Git";
  if (lower.includes("situational") || lower.includes("behavioral")) return "Situational Q&A";
  if (lower.includes("interview") || lower.includes("newsletter")) return "General Interview";
  if (lower.includes("testing")) return "Software Testing";
  return "General";
}
