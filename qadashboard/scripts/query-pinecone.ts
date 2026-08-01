import { Pinecone } from "@pinecone-database/pinecone";
import { config as loadEnv } from "dotenv";
import { join } from "path";

// Load .env from project root
loadEnv({ path: join(__dirname, "..", ".env") });

async function main() {
  const key = process.env.PINECONE_API_KEY || "";
  if (!key) throw new Error("PINECONE_API_KEY not set in .env");
  const indexName = process.env.PINECONE_INDEX_NAME || "qa-dashboard";
  const namespace = "qa-interview";

  const client = new Pinecone({ apiKey: key });
  const index = client.index(indexName);

  try {
    const stats = await index.describeIndexStats();
    console.log("Index stats:", JSON.stringify(stats));
  } catch (e) {
    console.error("Stats error:", e instanceof Error ? e.message : e);
  }

  // Query with a dummy embedding (1536 dims)
  try {
    const res = await index.namespace(namespace).query({
      vector: new Array(1536).fill(0.01),
      topK: 5,
      includeMetadata: true,
    });
    console.log("Query matches:", res.matches?.length);
    if (res.matches?.length) {
      console.log("First match:", JSON.stringify(res.matches[0], null, 2).slice(0, 800));
    }
  } catch (e) {
    console.error("Query error:", e instanceof Error ? e.message : e);
  }
}
main();
