import { Pinecone } from "@pinecone-database/pinecone";
import { config as loadEnv } from "dotenv";
import { join } from "path";

// Load .env from project root
loadEnv({ path: join(__dirname, "..", ".env") });

async function main() {
  const key = process.env.PINECONE_API_KEY || "";
  if (!key) throw new Error("PINECONE_API_KEY not set in .env");
  const client = new Pinecone({ apiKey: key });
  const index = client.index("qa-interview");

  const ids: string[] = [
    "004e4d29-c9c8-4fc7-8bf7-b4fd08e6884a",
    "007312c8-a5c0-45dc-ace0-3fff9a1e2a0e",
    "00eb37c2-107f-477a-b10d-c172bec94552",
    "01a29701-ee33-4cca-a5c2-7419bc980076",
    "01d3ddd9-2357-44af-bc2b-5aa89159b187",
    "01edafbe-9ad3-434f-ac88-48512bb80ba6",
  ];

  const fetched = await index.namespace("__default__").fetch({ ids: ids as [string, ...string[]] });
  for (const [id, vec] of Object.entries(fetched.records || {})) {
    const text = (vec.metadata?.text as string) || "";
    console.log(`\n=== ${id} (${text.length} chars) ===`);
    console.log(text.slice(0, 500));
  }
}
main().catch((e) => console.error("ERR:", e instanceof Error ? e.message : e));
