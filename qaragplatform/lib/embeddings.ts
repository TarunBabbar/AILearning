const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

export const EMBEDDING_DIM = 1536

export type EmbeddingProviderName = 'prompt' | string

function getProvider(): EmbeddingProviderName {
  return (process.env.EMBEDDING_MODEL as EmbeddingProviderName) || 'prompt'
}

export async function getEmbedding(text: string, provider?: EmbeddingProviderName): Promise<number[]> {
  const p = provider || getProvider()
  return p === 'prompt' ? promptBasedEmbedding(text) : apiEmbedding(text, p)
}

export async function getEmbeddingsBatch(texts: string[], provider?: EmbeddingProviderName): Promise<number[][]> {
  const p = provider || getProvider()
  if (p === 'prompt') {
    return Promise.all(texts.map(t => promptBasedEmbedding(t)))
  }
  return apiEmbeddingBatch(texts, p)
}

async function promptBasedEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENROUTER_API_KEY || ''

  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://qa-rag-platform.vercel.app',
      'X-Title': 'QA RAG Platform',
    },
    body: JSON.stringify({
      model: 'nvidia/nemotron-3-super-120b-a12b:free',
      messages: [
        {
          role: 'system',
          content: `Generate a dense vector embedding of the following text. Output ONLY a comma-separated list of ${EMBEDDING_DIM} floating point numbers between -1 and 1. No explanation.`
        },
        { role: 'user', content: text.substring(0, 2000) }
      ],
      temperature: 0.1,
      max_tokens: 2048,
    }),
  })

  if (!res.ok) {
    throw new Error(`Embedding API error ${res.status}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content || ''
  try {
    const nums: number[] = content.split(',').map((s: string) => parseFloat(s.trim())).filter((n: number) => !isNaN(n))
    if (nums.length >= EMBEDDING_DIM) return nums.slice(0, EMBEDDING_DIM)
    // Pad if too short
    if (nums.length >= 10) {
      const padded = [...nums]
      while (padded.length < EMBEDDING_DIM) padded.push(0)
      return padded
    }
  } catch {}
  return fallbackEmbedding()
}

async function apiEmbedding(text: string, model: string): Promise<number[]> {
  const apiKey = process.env.OPENROUTER_API_KEY || ''

  const res = await fetch(`${OPENROUTER_BASE}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: text.substring(0, 8000),
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenRouter embeddings API error ${res.status}: ${err}`)
  }

  const data = await res.json()
  return data.data?.[0]?.embedding || fallbackEmbedding()
}

async function apiEmbeddingBatch(texts: string[], model: string): Promise<number[][]> {
  const apiKey = process.env.OPENROUTER_API_KEY || ''

  const res = await fetch(`${OPENROUTER_BASE}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: texts.map(t => t.substring(0, 8000)),
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenRouter batch embeddings API error ${res.status}: ${err}`)
  }

  const data = await res.json()
  return data.data?.map((d: any) => d.embedding) || texts.map(() => fallbackEmbedding())
}

function fallbackEmbedding(): number[] {
  return Array.from({ length: EMBEDDING_DIM }, () => Math.random() * 2 - 1)
}
