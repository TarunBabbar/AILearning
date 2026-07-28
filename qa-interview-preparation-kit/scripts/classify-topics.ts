/**
 * Classify all Q&A pairs into AI-organized topics and save to persistent store.
 *
 * Run once after seeding:
 *   npx tsx scripts/classify-topics.ts
 */
import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const { getVectorStore } = await import("../lib/rag/vector-store-factory");
  const { organizeByAI } = await import("../lib/rag/topic-organizer");

  console.log("Fetching all Q&A pairs and classifying via LLM...\n");

  const store = await getVectorStore();
  const topics = await organizeByAI(store);

  console.log(`\nDone! ${topics.length} AI-organized topics saved.`);
  for (const t of topics) {
    console.log(`  ${t.name} (${t.questions.length} Q&A pairs)`);
  }
}

main().catch(console.error);
