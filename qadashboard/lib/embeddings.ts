import { getConfig } from "./config";

export async function getEmbedding(text: string): Promise<number[]> {
  const cfg = getConfig();
  const apiKey = cfg.openrouterApiKey;
  if (!apiKey) throw new Error("OpenRouter API key not configured");

  const res = await fetch(`${cfg.openrouterBaseUrl}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: cfg.embeddingModel,
      input: text,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "unknown error");
    throw new Error(`Embedding error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.data?.[0]?.embedding || [];
}

export async function getEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  const cfg = getConfig();
  const apiKey = cfg.openrouterApiKey;
  if (!apiKey) throw new Error("OpenRouter API key not configured");

  const res = await fetch(`${cfg.openrouterBaseUrl}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: cfg.embeddingModel,
      input: texts,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "unknown error");
    throw new Error(`Batch embedding error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.data
    ?.sort((a: { index: number }, b: { index: number }) => a.index - b.index)
    .map((d: { embedding: number[] }) => d.embedding) || [];
}
