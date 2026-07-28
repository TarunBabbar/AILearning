import { getOpenRouterClient } from "../openrouter";
import { getConfig } from "../config";

async function embed(input: string | string[]): Promise<number[] | number[][]> {
  const config = getConfig();
  const client = getOpenRouterClient();

  const response = await client.embeddings.create({
    model: config.embeddingModel,
    input,
    encoding_format: "float",
  });

  if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
    throw new Error(
      `Empty embeddings response: ${JSON.stringify(response).slice(0, 500)}`
    );
  }

  const embeddings = response.data.map((d: any) => {
    if (!d || !d.embedding) {
      throw new Error(`Missing embedding at index: ${JSON.stringify(d).slice(0, 200)}`);
    }
    return d.embedding;
  });
  return Array.isArray(input) ? embeddings : embeddings[0];
}

export async function getEmbedding(text: string): Promise<number[]> {
  return (await embed(text)) as number[];
}

export async function getEmbeddingsBatch(
  texts: string[]
): Promise<number[][]> {
  return (await embed(texts)) as number[][];
}
