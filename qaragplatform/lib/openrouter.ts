const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function chatCompletion(
  messages: ChatMessage[],
  model: string = 'nvidia/nemotron-3-super-120b-a12b:free',
  temperature: number = 0.7
): Promise<string> {
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
      model,
      messages,
      temperature,
      max_tokens: 4096,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenRouter API error ${res.status}: ${err}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

export const FREE_MODELS = [
  { id: 'nvidia/nemotron-3-super-120b-a12b:free', name: 'NVIDIA Nemotron 3 Super', description: '120B param MoE, 1M context - Best for RAG Q&A' },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Meta Llama 3.3 70B', description: 'Strong general purpose model' },
  { id: 'tencent/hy3:free', name: 'Tencent Hy3', description: '295B MoE, strong reasoning' },
  { id: 'nvidia/nemotron-3-ultra-550b-a55b:free', name: 'NVIDIA Nemotron 3 Ultra', description: '550B MoE reasoning model' },
  { id: 'qwen/qwen3-next-80b-a3b-instruct:free', name: 'Qwen 3 Next 80B', description: 'Fast MoE, good for chat' },
  { id: 'google/gemma-4-31b-it:free', name: 'Google Gemma 4 31B', description: 'Dense 31B model' },
  { id: 'openrouter/free', name: 'Auto Free Router', description: 'Picks best free model automatically' },
]

export const DEFAULT_MODEL = FREE_MODELS[0].id
