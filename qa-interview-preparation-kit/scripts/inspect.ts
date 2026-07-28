/**
 * Inspect script: Show what data is stored in ChromaDB.
 *
 * Usage: npx tsx scripts/inspect.ts
 *
 * Run this before seeding to verify clean slate,
 * or after seeding to verify data quality.
 */

import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const { getVectorStore } = await import("../lib/rag/vector-store-factory");

  const store = await getVectorStore();

  const count = await store.getChunkCount();
  const docs = await store.listDocuments();
  const topics = await store.getTopics();

  console.log("\n=== ChromaDB Inspection ===\n");
  console.log(`Total chunks: ${count}`);
  console.log(`Documents: ${docs.length}`);
  console.log(`Topics: ${topics.length}\n`);

  if (docs.length > 0) {
    console.log("--- Documents ---");
    for (const doc of docs) {
      console.log(`  ${doc}`);
    }
  }

  if (topics.length > 0) {
    console.log("\n--- Topics ---");
    for (const topic of topics) {
      const questions = await store.getQuestionsByTopic(topic);
      console.log(`\n  ${topic} (${questions.length} Q&A pairs):`);
      for (const q of questions.slice(0, 3)) {
        console.log(`    Q: ${q.question.slice(0, 100)}`);
        console.log(`    A: ${q.answer.slice(0, 100)}...`);
        console.log(`    Source: ${q.source}`);
        console.log();
      }
      if (questions.length > 3) {
        console.log(`    ... and ${questions.length - 3} more`);
      }
    }
  } else {
    console.log("No data found. Run `npm run seed` first.");
  }

  console.log("\n=== End ===\n");
}

main().catch(console.error);
