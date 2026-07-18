import { getEmbedding, getEmbeddingsBatch } from './embeddings'

export interface SearchResult {
  docId: string
  docName: string
  chunkIndex: number
  text: string
  score: number
}

export interface ChunkInput {
  text: string
  index: number
}

export interface DocMetadata {
  id: string
  name: string
  type: string
  size: number
  chunks: number
  uploadedAt: string
}

export interface VectorStore {
  indexChunks(docId: string, docName: string, chunks: ChunkInput[]): Promise<void>
  search(queryOrEmbedding: string | number[], topK?: number, filterDocIds?: string[]): Promise<SearchResult[]>
  listDocuments(): Promise<DocMetadata[]>
  deleteDocument(docId: string): Promise<void>
}

// ─── In-Memory Vector Store ────────────────────────────────────────────────

interface MemVector {
  id: string
  docId: string
  docName: string
  chunkIndex: number
  text: string
  embedding: number[]
}

const memStore: Map<string, MemVector> = new Map()
const memDocMeta: Map<string, DocMetadata> = new Map()

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1)
}

function createMemoryStore(): VectorStore {
  return {
    async indexChunks(docId: string, docName: string, chunks: ChunkInput[]) {
      if (chunks.length === 0) return
      const embeddings = await getEmbeddingsBatch(chunks.map(c => c.text))
      for (let i = 0; i < chunks.length; i++) {
        const id = `${docId}-${chunks[i].index}`
        memStore.set(id, {
          id,
          docId,
          docName,
          chunkIndex: chunks[i].index,
          text: chunks[i].text,
          embedding: embeddings[i],
        })
      }
    },

    async search(queryOrEmbedding: string | number[], topK = 5, filterDocIds?: string[]) {
      const queryEmbedding = Array.isArray(queryOrEmbedding)
        ? queryOrEmbedding
        : await getEmbedding(queryOrEmbedding)

      const vectors = Array.from(memStore.values())
      const filtered = filterDocIds
        ? vectors.filter(v => filterDocIds.includes(v.docId))
        : vectors

      if (filtered.length === 0) return []

      const scored = filtered.map(v => ({
        docId: v.docId,
        docName: v.docName,
        chunkIndex: v.chunkIndex,
        text: v.text,
        score: cosineSimilarity(queryEmbedding, v.embedding),
      }))

      scored.sort((a, b) => b.score - a.score)
      return scored.slice(0, topK)
    },

    async listDocuments() {
      return Array.from(memDocMeta.values()).sort((a, b) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      )
    },

    async deleteDocument(docId: string) {
      for (const [key, val] of memStore) {
        if (val.docId === docId) memStore.delete(key)
      }
      memDocMeta.delete(docId)
    },
  }
}

// ─── Pinecone Vector Store ─────────────────────────────────────────────────

// Dummy zero vector for metadata queries (1536-dim)
const ZERO_VEC = Array(1536).fill(0)

async function createPineconeStore(): Promise<VectorStore> {
  const { Pinecone } = await import('@pinecone-database/pinecone')
  const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! })
  const indexName = process.env.PINECONE_INDEX || 'rag-embeddings'

  const existing = await pc.listIndexes()
  const hasIndex = existing.indexes?.some((i: any) => i.name === indexName)
  if (!hasIndex) {
    throw new Error(`Pinecone index "${indexName}" not found.`)
  }

  const index = pc.index({ name: indexName })

  // Helper to build metadata key for a given doc
  const metaId = (docId: string) => `_meta_${docId}`

  return {
    async indexChunks(docId: string, docName: string, chunks: ChunkInput[]) {
      if (chunks.length === 0) return
      const embeddings = await getEmbeddingsBatch(chunks.map(c => c.text))
      const records = chunks.map((c, i) => ({
        id: `${docId}-${c.index}`,
        values: embeddings[i],
        metadata: {
          docId,
          docName,
          chunkIndex: c.index,
          text: c.text,
        },
      }))

      // Upsert chunks in batches
      for (let i = 0; i < records.length; i += 100) {
        const batch = records.slice(i, i + 100)
        if (batch.length > 0) {
          await index.upsert({ records: batch })
        }
      }
    },

    async search(queryOrEmbedding: string | number[], topK = 5, filterDocIds?: string[]) {
      const queryEmbedding = Array.isArray(queryOrEmbedding)
        ? queryOrEmbedding
        : await getEmbedding(queryOrEmbedding)

      const filter = filterDocIds && filterDocIds.length > 0
        ? { docId: { $in: filterDocIds } }
        : undefined

      const result = await index.query({
        vector: queryEmbedding,
        topK,
        includeMetadata: true,
        filter,
      })

      return (result.matches || []).map(m => ({
        docId: (m.metadata as any)?.docId || '',
        docName: (m.metadata as any)?.docName || 'Unknown',
        chunkIndex: (m.metadata as any)?.chunkIndex || 0,
        text: (m.metadata as any)?.text || '',
        score: m.score || 0,
      }))
    },

    async listDocuments() {
      // Fetch all chunks (up to 10K), deduplicate by docId
      const result = await index.query({
        vector: ZERO_VEC,
        topK: 10000,
        includeMetadata: true,
      })

      const docMap = new Map<string, DocMetadata>()
      for (const match of result.matches || []) {
        const meta = match.metadata as any
        if (!meta?.docId) continue
        if (!docMap.has(meta.docId)) {
          docMap.set(meta.docId, {
            id: meta.docId,
            name: meta.docName || 'Unknown',
            type: 'text/plain',
            size: 0,
            chunks: 0,
            uploadedAt: new Date().toISOString(),
          })
        }
        const entry = docMap.get(meta.docId)!
        entry.chunks++
      }

      return Array.from(docMap.values()).sort((a, b) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      )
    },

    async deleteDocument(docId: string) {
      // Fetch all vector IDs for this doc, then delete by ID
      const prefix = `${docId}-`
      const ids: string[] = []
      let pagToken: string | undefined
      do {
        const listResult = await index.listPaginated({ limit: 1000, paginationToken: pagToken })
        if (listResult.vectors) {
          for (const v of listResult.vectors) {
            if (v.id?.startsWith(prefix)) ids.push(v.id!)
          }
        }
        pagToken = listResult.pagination?.next
      } while (pagToken)

      if (ids.length > 0) {
        await index.deleteMany({ ids })
      }
    },
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

let storeInstance: VectorStore | null = null

export async function getVectorStore(): Promise<VectorStore> {
  if (storeInstance) return storeInstance

  if (process.env.PINECONE_API_KEY) {
    storeInstance = await createPineconeStore()
  } else {
    storeInstance = createMemoryStore()
  }

  return storeInstance
}
