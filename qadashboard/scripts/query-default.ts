import { Pinecone } from "@pinecone-database/pinecone";
import { config as loadEnv } from "dotenv";
import { join } from "path";

// Load .env from project root
loadEnv({ path: join(__dirname, "..", ".env") });

async function main() {
  const key = process.env.PINECONE_API_KEY || "";
  if (!key) throw new Error("PINECONE_API_KEY not set in .env");
  const openrouterApiKey = process.env.OPENROUTER_API_KEY || "";
  if (!openrouterApiKey) throw new Error("OPENROUTER_API_KEY not set in .env");
  const indexName = process.env.PINECONE_INDEX_NAME || "qa-dashboard";

  const client = new Pinecone({ apiKey: key });
  const index = client.index(indexName);

  // Query default namespace with a real embedding (fetch via OpenRouter)
  const embRes = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openrouterApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/text-embedding-3-small",
      input: "What is AI testing?",
    }),
  });
  const embData = await embRes.json();
  const vector = embData.data?.[0]?.embedding;
  console.log("Embedding dims:", vector?.length);

  const res = await index.namespace("__default__").query({
    vector,
    topK: 5,
    includeMetadata: true,
  });
  console.log("Matches:", res.matches?.length);
  res.matches?.forEach((m) => {
    console.log("---", m.score?.toFixed(3), (m.metadata?.text as string)?.slice(0, 120));
  });
}
main().catch((e) => console.error("ERR:", e instanceof Error ? e.message : e));
