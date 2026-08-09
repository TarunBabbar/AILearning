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

  // List some vector IDs from default namespace
  const listRes = await index.namespace("__default__").listPaginated({ limit: 10 });
  const ids: string[] = [];
  for (const v of listRes.vectors || []) {
    if (v.id) ids.push(v.id);
  }
  console.log("Sample IDs:", ids);

  if (ids.length > 0) {
    const fetched = await index.namespace("__default__").fetch({ ids: ids as [string, ...string[]] });
    for (const [id, vec] of Object.entries(fetched.records || {})) {
      const text = (vec.metadata?.text as string) || "";
      console.log(`\n=== ${id} (${text.length} chars) ===`);
      console.log(text.slice(0, 400));
    }
  }
}
main().catch((e) => console.error("ERR:", e instanceof Error ? e.message : e));
