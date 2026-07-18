import { getVectorStore, DocMetadata } from './vector-store'
import { summarizeContent } from './summarizer'

// In-memory fallback store
interface RawDocument {
  id: string
  name: string
  type: string
  size: number
  content: string
  chunks: string[]
  uploadedAt: Date
}

const globalStore: { documents: Map<string, RawDocument> } =
  (globalThis as any).__documentStore || { documents: new Map() }
;(globalThis as any).__documentStore = globalStore

export interface Document extends RawDocument {}

export const documentStore = {
  async add(doc: Document) {
    globalStore.documents.set(doc.id, doc)

    // Generate summary chunk for document-level stats
    const summary = summarizeContent(doc.name, doc.content, doc.type)
    const allChunks = summary
      ? [summary.text, ...doc.chunks]
      : doc.chunks

    try {
      const store = await getVectorStore()
      await store.indexChunks(doc.id, doc.name, allChunks.map((text, index) => ({ text, index })))
    } catch {}
  },

  get(id: string): Document | undefined {
    return globalStore.documents.get(id)
  },

  getAll(): Document[] {
    return Array.from(globalStore.documents.values()).sort(
      (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    )
  },

  async delete(id: string) {
    globalStore.documents.delete(id)
    // Also delete from vector store (non-blocking)
    try {
      const store = await getVectorStore()
      await store.deleteDocument(id)
    } catch {}
  },

  async getStats(): Promise<{ totalDocs: number; totalChunks: number; totalSize: number }> {
    // Try vector store first for persistent stats
    try {
      const store = await getVectorStore()
      const docs = await store.listDocuments()
      if (docs.length > 0) {
        const localDocs = globalStore.documents
        let totalSize = 0
        Array.from(localDocs.values()).forEach(d => { totalSize += d.size })
        return {
          totalDocs: docs.length,
          totalChunks: docs.reduce((s, d) => s + d.chunks, 0),
          totalSize,
        }
      }
    } catch {}

    const docs = this.getAll()
    const totalChunks = docs.reduce((sum, d) => sum + d.chunks.length, 0)
    const totalSize = docs.reduce((sum, d) => sum + d.size, 0)
    return { totalDocs: docs.length, totalChunks, totalSize }
  },
}
