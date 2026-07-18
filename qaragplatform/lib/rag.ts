import { chatCompletion, ChatMessage } from './openrouter'
import { getVectorStore, DocMetadata } from './vector-store'
import { documentStore } from './document-store'

export function chunkText(text: string, chunkSize: number = 1536, overlap: number = 200): string[] {
  if (!text || !text.trim()) return []
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length)
    chunks.push(text.slice(start, end))
    start += chunkSize - overlap
  }
  return chunks.filter(c => c.trim().length > 0)
}

export async function answerQuestion(
  question: string,
  documentIds?: string[],
  model?: string,
): Promise<{ answer: string; sources: { documentId: string; docName: string; chunkIndex: number; text: string }[] }> {
  const store = await getVectorStore()

  // Check if docs exist via vector store
  const allDocs = await store.listDocuments()
  if (allDocs.length === 0) {
    return {
      answer: 'No documents uploaded yet. Please upload documents first to ask questions about them.',
      sources: []
    }
  }

  // Search vector store
  const results = await store.search(question, 20, documentIds)

  if (results.length === 0) {
    return {
      answer: 'No relevant content found. Try uploading documents first.',
      sources: [],
    }
  }

  // Build context from results
  const context = results.map(r =>
    `[${r.docName}, Chunk ${r.chunkIndex + 1}]\n${r.text}`
  ).join('\n\n')

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `You are a helpful Q&A assistant. Answer questions based ONLY on the provided context below.
If the context doesn't contain enough information to answer, say so clearly.
Do NOT cite source names or chunk numbers inline in your answer — keep it natural.
Reference sections are shown separately below the answer.
Keep answers concise but thorough.

Context:
${context}`
    },
    { role: 'user', content: question }
  ]

  const answer = await chatCompletion(messages, model)

  const sources = results.map(r => ({
    documentId: r.docId,
    docName: r.docName,
    chunkIndex: r.chunkIndex,
    text: r.text.substring(0, 200) + (r.text.length > 200 ? '...' : ''),
  }))

  return { answer, sources }
}
