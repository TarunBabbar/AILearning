/**
 * Rebuild the local metadata index from existing Pinecone data.
 *
 * Run once after switching to Pinecone or if pinecone-index.json gets lost:
 *   npx tsx scripts/rebuild-index.ts
 */
import { config } from "dotenv";
import path from "path";
import fs from "fs";
import { Pinecone } from "@pinecone-database/pinecone";

config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const apiKey = process.env.PINECONE_API_KEY;
  const indexName = process.env.PINECONE_INDEX_NAME || "qa-interview";
  const dataPath = path.resolve(process.cwd(), process.env.DATA_PATH || "./pinecone_data");

  if (!apiKey) {
    console.error("PINECONE_API_KEY not set");
    process.exit(1);
  }

  const client = new Pinecone({ apiKey });
  const index = client.index(indexName);

  const stats = await index.describeIndexStats();
  const totalRecords = stats.totalRecordCount || 0;
  console.log(`Pinecone index "${indexName}" has ${totalRecords} total records`);

  if (totalRecords === 0) {
    console.log("No records found. Nothing to rebuild.");
    return;
  }

  // Use listPaginated to get all vector IDs in batches
  const documents = new Set<string>();
  const topics = new Map<string, number>();
  let paginationToken: string | undefined | null = undefined;
  let fetched = 0;

  do {
    const result = await index.listPaginated({ limit: 99, paginationToken });
    const ids = (result.vectors || []).map((v: any) => v.id);
    paginationToken = result.pagination?.next as string | undefined | null;

    if (ids.length === 0) break;

    // Fetch metadata for this batch
    const fetchResult = await index.fetch(ids);
    for (const [id, vec] of Object.entries(fetchResult.records || {})) {
      const meta = (vec as any).metadata || {};
      if (meta.source) documents.add(meta.source as string);
      if (meta.topic) {
        const t = meta.topic as string;
        topics.set(t, (topics.get(t) || 0) + 1);
      }
    }

    fetched += ids.length;
    console.log(`  Processed ${fetched}/${totalRecords} vectors`);
  } while (paginationToken);

  const indexData = {
    documents: Array.from(documents).sort(),
    topics: Object.fromEntries(topics),
  };

  // Write sidecar file
  if (!fs.existsSync(dataPath)) fs.mkdirSync(dataPath, { recursive: true });
  const outPath = path.join(dataPath, "pinecone-index.json");
  fs.writeFileSync(outPath, JSON.stringify(indexData, null, 2), "utf-8");

  console.log(`\nDone! Indexed ${documents.size} documents and ${topics.size} topics.`);
  console.log(`File written to: ${outPath}`);
}

main().catch(console.error);
