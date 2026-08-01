import { Pinecone } from "@pinecone-database/pinecone";
import { getConfig } from "@/lib/config";
import { getEmbeddingsBatch } from "@/lib/embeddings";
import { readFileSync } from "fs";
import { join } from "path";

export async function POST() {
  try {
    const cfg = getConfig();
    if (!cfg.pineconeApiKey) {
      return Response.json({ error: "PINECONE_API_KEY not set" }, { status: 500 });
    }

    // Read ai-topics.json
    const filePath = join(process.cwd(), "data", "ai-topics.json");
    const raw = readFileSync(filePath, "utf-8");
    const data: { name: string; questions: { question: string; answer: string; source: string }[] }[] = JSON.parse(raw);

    // Flatten all Q&A into chunks
    const chunks: { id: string; text: string; source: string }[] = [];
    for (const topic of data) {
      for (const q of topic.questions) {
        chunks.push({
          id: `${topic.name}-${chunks.length}`,
          text: `Q: ${q.question}\nA: ${q.answer}`,
          source: q.source,
        });
      }
    }

    // Embed in batches
    const client = new Pinecone({ apiKey: cfg.pineconeApiKey });
    const index = client.index(cfg.pineconeIndexName);
    const namespace = "qa-interview";

    const BATCH = 100;
    let upserted = 0;
    for (let i = 0; i < chunks.length; i += BATCH) {
      const batch = chunks.slice(i, i + BATCH);
      const embeddings = await getEmbeddingsBatch(batch.map((c) => c.text));
      await index.namespace(namespace).upsert({
        records: batch.map((c, j) => ({
          id: c.id,
          values: embeddings[j],
          metadata: { text: c.text, source: c.source } as Record<string, string>,
        })),
      });
      upserted += batch.length;
    }

    return Response.json({
      success: true,
      message: `Indexed ${upserted} Q&A pairs into Pinecone namespace "${namespace}"`,
      pairs: upserted,
      namespace,
    });
  } catch (err) {
    console.error("[seed] Failed:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Seed failed" },
      { status: 500 }
    );
  }
}
