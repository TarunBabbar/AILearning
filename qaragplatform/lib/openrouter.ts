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

// Ordered: the first entry is the default (see DEFAULT_MODEL). Slugs rotate on
// OpenRouter, so these were checked against the live free list; a plain instruct
// model leads because reasoning models can spend the whole token budget on hidden
// reasoning and return no answer at all.
export const FREE_MODELS = [
  { id: 'qwen/qwen3.8-27b:free', name: 'Qwen 3.8 27B', description: 'Strong general instruct model - best default for RAG Q&A' },
  { id: 'inclusionai/ling-3.0-flash-sante:free', name: 'Ling 3.0 Flash', description: 'Fast hybrid-reasoning MoE, reliable citations' },
  { id: 'cohere/north-mini-code:free', name: 'Cohere North Mini', description: 'Compact, good for code and structured answers' },
  { id: 'google/gemma-4-31b-it:free', name: 'Google Gemma 4 31B', description: 'Dense 31B general model' },
  { id: 'dots-studio/dots-3-note-preview:free', name: 'Dots 3 Note', description: 'Long-context document model' },
  { id: 'nvidia/nemotron-3-super-120b-a12b:free', name: 'NVIDIA Nemotron 3 Super', description: '120B MoE, 1M context (reasoning)' },
  { id: 'openrouter/free', name: 'Auto Free Router', description: 'Lets OpenRouter pick a free model automatically' },
]

export const DEFAULT_MODEL = FREE_MODELS[0].id
