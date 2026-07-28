/**
 * Seed script: Index all PDFs from docs/ into vector store.
 *
 * Usage: npm run seed
 *
 * Set env vars in .env.local before running:
 *   OPENROUTER_API_KEY=sk-or-...
 *   VECTOR_DB=chromadb (default)
 */

import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { config } from "dotenv";

// Load .env.local
config({ path: path.resolve(process.cwd(), ".env.local") });

const DOCS_DIR = path.resolve(process.cwd(), "docs");
const DATA_DIR = path.resolve(process.cwd(), "pinecone_data");

async function main() {
  // Optional file filter: npm run seed -- --files="file1.pdf,file2.docx" or just "api"
  const fileFilter = process.argv.find((a) => a.startsWith("--files="))?.split("=")[1];
  const fileFilterList = fileFilter
    ? fileFilter.split(",").map((f) => f.trim().toLowerCase())
    : null;
  if (fileFilterList) {
    console.log(`🔍 File filter active: ${fileFilterList.join(", ")}`);
  }

  console.log("=== QA Interview Seed Script ===");
  console.log(`Docs dir: ${DOCS_DIR}`);
  console.log(`Vector DB: ${process.env.VECTOR_DB || "chromadb"}`);

  // Ensure data dir exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Check API key
  if (!process.env.OPENROUTER_API_KEY) {
    console.error("ERROR: OPENROUTER_API_KEY not set in .env.local");
    process.exit(1);
  }

  // Get PDF and DOCX files
  let docFiles = fs
    .readdirSync(DOCS_DIR)
    .filter((f) => f.endsWith(".pdf") || f.endsWith(".docx"))
    .sort();

  if (fileFilterList) {
    docFiles = docFiles.filter((f) =>
      fileFilterList.some((filter) => f.toLowerCase().includes(filter))
    );
    if (docFiles.length === 0) {
      console.log("No files matched the filter. Available files:");
      for (const f of fs.readdirSync(DOCS_DIR).filter((f) => f.endsWith(".pdf") || f.endsWith(".docx")).sort()) {
        console.log(`  ${f}`);
      }
      return;
    }
  }

  if (docFiles.length === 0) {
    console.log("No PDF or DOCX files found in docs/ directory.");
    return;
  }

  console.log(`Found ${docFiles.length} files to index.\n`);

  const { parsePDF, parseDOCX } = await import(
    "../lib/rag/document-loader"
  );
  const { getEmbeddingsBatch } = await import("../lib/rag/embeddings");
  const { extractQAPairs } = await import("../lib/rag/qa-extractor");
  const { getVectorStore } = await import("../lib/rag/vector-store-factory");

  const store = await getVectorStore();

  // Wipe all existing data only when doing a full re-seed
  if (!fileFilterList) {
    if (typeof (store as any).reset === "function") {
      console.log("🗑️  Clearing existing data...");
      await (store as any).reset();
    }
  }

  let totalChunks = 0;

  for (let i = 0; i < docFiles.length; i++) {
    const fileName = docFiles[i];
    const filePath = path.join(DOCS_DIR, fileName);
    const fileSize = fs.statSync(filePath).size;
    const sizeMB = (fileSize / (1024 * 1024)).toFixed(2);

    console.log(`[${i + 1}/${docFiles.length}] Processing: ${fileName} (${sizeMB} MB)`);

    try {
      const buffer = fs.readFileSync(filePath);

      // Parse based on extension
      const parsed = fileName.endsWith(".docx")
        ? await parseDOCX(buffer, fileName)
        : await parsePDF(buffer, fileName);

      console.log(`  📄 ${parsed.metadata.pageCount} pages, ${parsed.metadata.totalChars.toLocaleString()} chars extracted`);

      // Use LLM to extract clean Q&A pairs
      console.log(`  🤖 Calling LLM to extract Q&A pairs (${parsed.metadata.totalChars.toLocaleString()} chars, sending first 30KB)...`);
      const startTime = Date.now();
      const qaPairs = await extractQAPairs(parsed.text);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`  ⏱️  LLM took ${elapsed}s, got ${qaPairs.length} Q&A pairs`);

      if (qaPairs.length === 0) {
        console.log(`  ⚠ No Q&A pairs extracted, skipping.`);
        continue;
      }

      console.log(`  ✅ Extracted ${qaPairs.length} Q&A pairs`);

      // Guess topic from filename
      const topic = guessTopic(fileName);

      // Prepare chunks — each Q&A pair is one chunk (answer = text, question = metadata)
      const chunks = qaPairs.map((qa) => ({
        text: qa.answer,
        metadata: {
          source: fileName,
          type: "qa-document",
          question: qa.question,
          topic,
        },
      }));

      // Generate embeddings in batches of 500
      const texts = chunks.map((c) => c.text);
      const embeddings: number[][] = [];

      const BATCH = 500;
      for (let b = 0; b < texts.length; b += BATCH) {
        const batch = texts.slice(b, b + BATCH);
        try {
          const batchEmbeds = await getEmbeddingsBatch(batch);
          if (!batchEmbeds || batchEmbeds.length === 0) {
            console.log(`  ⚠ Embeddings returned empty batch, skipping`);
            continue;
          }
          embeddings.push(...batchEmbeds);
          console.log(`  ⚡ Embeddings: ${Math.min(b + BATCH, texts.length)}/${texts.length}`);
        } catch (embedErr: any) {
          console.log(`  ⚠ Embedding error: ${embedErr.message.slice(0, 100)}`);
          continue;
        }
      }

      if (embeddings.length === 0) {
        console.log(`  ⚠ No embeddings generated, skipping file`);
        continue;
      }

      // Upsert to vector store
      const data = chunks.slice(0, embeddings.length).map((chunk, idx) => ({
        id: uuidv4(),
        text: chunk.text,
        embedding: embeddings[idx],
        metadata: {
          ...chunk.metadata,
          chunkIndex: idx,
          totalChunks: chunks.length,
        },
      }));

      await store.upsert(data);
      totalChunks += chunks.length;

      console.log(`  ✅ Indexed ${chunks.length} Q&A pairs under topic "${topic}"`);
    } catch (err: any) {
      console.error(`  ❌ Error: ${err.message}`);
    }

    console.log("");
  }

  console.log("=== Seed complete ===");
  console.log(`Total files: ${docFiles.length}`);
  console.log(`Total chunks indexed: ${totalChunks}`);

  const docCount = await store.getDocumentCount();
  const chunkCount = await store.getChunkCount();
  console.log(`Documents in store: ${docCount}`);
  console.log(`Total chunks in store: ${chunkCount}`);
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
  if (lower.includes("situational")) return "Situational Q&A";
  if (lower.includes("interview") || lower.includes("newsletter")) return "General Interview";
  if (lower.includes("testing")) return "Software Testing";
  return "General";
}

main().catch(console.error);
