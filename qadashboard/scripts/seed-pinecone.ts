import { Pinecone } from "@pinecone-database/pinecone";
import { config as loadEnv } from "dotenv";
import { readFileSync } from "fs";
import { join } from "path";

// Load .env from project root
loadEnv({ path: join(__dirname, "..", ".env") });

const openrouterApiKey = process.env.OPENROUTER_API_KEY || "";
const openrouterBaseUrl = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
const embeddingModel = process.env.EMBEDDING_MODEL || "text-embedding-3-small";
const pineconeApiKey = process.env.PINECONE_API_KEY || "";
if (!pineconeApiKey) throw new Error("PINECONE_API_KEY not set in .env");
const pineconeIndexName = process.env.PINECONE_INDEX_NAME || "qa-dashboard";

async function getEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  if (!openrouterApiKey) throw new Error("OPENROUTER_API_KEY not set");
  const res = await fetch(`${openrouterBaseUrl}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openrouterApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: embeddingModel, input: texts }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "unknown");
    throw new Error(`Embedding error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.data
    ?.sort((a: { index: number }, b: { index: number }) => a.index - b.index)
    .map((d: { embedding: number[] }) => d.embedding) || [];
}

async function main() {
  console.log("Pinecone API key set:", !!pineconeApiKey);
  console.log("Index:", pineconeIndexName);
  console.log("Embedding model:", embeddingModel);

  const filePath = join(process.cwd(), "data", "ai-topics.json");
  const raw = readFileSync(filePath, "utf-8");
  const data: { name: string; questions: { question: string; answer: string; source: string }[] }[] = JSON.parse(raw);
  console.log("Loaded topics:", data.length);

  const chunks: { id: string; text: string; source: string }[] = [];
  for (const topic of data) {
    for (const q of topic.questions) {
      chunks.push({
        id: `${topic.name.replace(/[^a-zA-Z0-9]/g, "-")}-${chunks.length}`,
        text: `Q: ${q.question}\nA: ${q.answer}`,
        source: q.source,
      });
    }
  }
  console.log("Total chunks:", chunks.length);

  const client = new Pinecone({ apiKey: pineconeApiKey });
  console.log("Pinecone client created");

  const index = client.index(pineconeIndexName);
  try {
    const stats = await index.describeIndexStats();
    console.log("Index stats:", JSON.stringify(stats));
  } catch (e) {
    console.error("describeIndexStats error:", e instanceof Error ? e.message : e);
  }

  const namespace = process.env.PINECONE_NAMESPACE || "qa-interview";
  const BATCH = 50;
  let upserted = 0;

  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    console.log(`Embedding batch ${i}-${i + batch.length}...`);
    const embeddings = await getEmbeddingsBatch(batch.map((c) => c.text));
    console.log(`  Got ${embeddings.length} embeddings`);
    await index.namespace(namespace).upsert({
      records: batch.map((c, j) => ({
        id: c.id,
        values: embeddings[j],
        metadata: { text: c.text, source: c.source } as Record<string, string>,
      })),
    });
    upserted += batch.length;
    console.log(`  Upserted ${upserted} so far`);
  }

  console.log(`DONE: Indexed ${upserted} chunks into ${pineconeIndexName}/${namespace}`);
}

main().catch((e) => {
  console.error("SEED FAILED:", e);
  process.exit(1);
});
