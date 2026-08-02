// RAG layer: free local embeddings (transformers.js, no API cost) + Pinecone
// free-serverless vector store. Used to ground test-case generation against
// existing cases (dedupe / avoid "weird" cases).

import { getConfig } from "../config";
import type { ExternalTestCase, VectorRecord } from "../types";

// ---------------------------------------------------------------------------
// Embedding — free local model via transformers.js
// ---------------------------------------------------------------------------

// Cache the pipeline so repeated calls don't re-download the model.
let pipelinePromise: Promise<{
  embed: (text: string) => Promise<{ data: Array<{ embedding: number[] }> }>;
}> | null = null;

function loadPipeline() {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const { pipeline } = await import("@huggingface/transformers");
      const embedder = await pipeline("feature-extraction", getConfig().embeddingModel, {
        dtype: "q8",
      });
      return {
        async embed(text: string) {
          const out = await embedder(text, { pooling: "mean", normalize: true });
          return { data: [{ embedding: Array.from(out.data as unknown as number[]) }] };
        },
      };
    })();
  }
  return pipelinePromise;
}

// Deterministic 384-dim fallback (hashed tokens) when transformers.js is
// unavailable — keeps the pipeline runnable offline, no API cost.
function hashEmbedding(text: string): number[] {
  const dim = 384;
  const vec = new Array<number>(dim).fill(0);
  const tokens = text.toLowerCase().split(/\W+/).filter(Boolean);
  for (const t of tokens) {
    let h = 2166136261;
    for (let i = 0; i < t.length; i++) {
      h ^= t.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const idx = Math.abs(h) % dim;
    vec[idx] += 1;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

export async function embed(text: string): Promise<number[]> {
  try {
    const p = await loadPipeline();
    const res = await p.embed(text.slice(0, 2000));
    const v = res.data[0]?.embedding;
    if (v && v.length > 0) return v;
  } catch {
    // fall through to hash
  }
  return hashEmbedding(text);
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  return Promise.all(texts.map(embed));
}

// ---------------------------------------------------------------------------
// Pinecone (free serverless tier) client
// ---------------------------------------------------------------------------

function pineconeConfigured(): boolean {
  const cfg = getConfig();
  return Boolean(cfg.pineconeApiKey && cfg.pineconeIndex);
}

function pineconeBase(): string {
  const cfg = getConfig();
  return cfg.pineconeHost
    ? `https://${cfg.pineconeHost}`
    : `https://${cfg.pineconeIndex}-${cfg.pineconeApiKey?.slice(0, 8) || "srv"}.svc.pinecone.io`;
}

async function pcRequest(
  path: string,
  opts: { method?: string; body?: unknown }
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const cfg = getConfig();
  try {
    const res = await fetch(`${pineconeBase()}${path}`, {
      method: opts.method || "POST",
      headers: {
        "Api-Key": cfg.pineconeApiKey,
        "Content-Type": "application/json",
        "X-Pinecone-API-Version": "2024-10",
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const text = await res.text().catch(() => "");
    let data: unknown = text;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      // non-JSON
    }
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, data: { error: err instanceof Error ? err.message : String(err) } };
  }
}

export async function upsertVectors(records: VectorRecord[]): Promise<{ ok: boolean; message: string }> {
  if (!pineconeConfigured()) {
    return { ok: false, message: "Skipping Pinecone — no PINECONE_API_KEY / PINECONE_INDEX configured. Proceeding without comparing existing test cases." };
  }
  const res = await pcRequest("/vectors/upsert", {
    method: "POST",
    body: { vectors: records.map((r) => ({ id: r.id, values: r.values, metadata: r.metadata })) },
  });
  if (!res.ok) return { ok: false, message: `Skipping Pinecone — connection issue (${JSON.stringify(res.data).slice(0, 120)}). Proceeding without comparing existing test cases.` };
  return { ok: true, message: `Upserted ${records.length} vectors` };
}

export async function queryVectors(
  vector: number[],
  topK = 5
): Promise<{ ok: boolean; matches: Array<{ id: string; score: number; metadata?: VectorRecord["metadata"] }>; message?: string }> {
  if (!pineconeConfigured()) {
    return { ok: false, matches: [], message: "Skipping Pinecone — no PINECONE_API_KEY / PINECONE_INDEX configured. Proceeding without comparing existing test cases." };
  }
  const res = await pcRequest("/query", {
    method: "POST",
    body: { vector, topK, includeMetadata: true },
  });
  if (!res.ok) return { ok: false, matches: [], message: `Skipping Pinecone — connection issue (${JSON.stringify(res.data).slice(0, 120)}). Proceeding without comparing existing test cases.` };
  const data = res.data as { matches?: Array<{ id: string; score: number; metadata?: VectorRecord["metadata"] }> };
  return { ok: true, matches: data.matches || [] };
}

export async function indexExternalCases(
  cases: ExternalTestCase[],
  source: string
): Promise<{ ok: boolean; message: string; count: number }> {
  if (!cases.length) return { ok: true, message: "No cases to index", count: 0 };
  const texts = cases.map((c) => `${c.title}. ${c.description || ""} ${(c.steps || []).join(" ")}`);
  const vectors = await embedBatch(texts);
  const records: VectorRecord[] = cases.map((c, i) => ({
    id: `${source}-${c.id || i}`,
    values: vectors[i],
    metadata: { title: c.title, source, text: texts[i] },
  }));
  const res = await upsertVectors(records);
  return { ok: res.ok, message: res.message, count: records.length };
}

export async function findSimilarCases(
  text: string,
  topK = 5
): Promise<{ ok: boolean; matches: Array<{ id: string; score: number; title: string; text: string }>; message?: string }> {
  const vector = await embed(text);
  const res = await queryVectors(vector, topK);
  return {
    ok: res.ok,
    matches: (res.matches || []).map((m) => ({
      id: m.id,
      score: m.score,
      title: m.metadata?.title || m.id,
      text: m.metadata?.text || "",
    })),
    message: res.message,
  };
}
