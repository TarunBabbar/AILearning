import { NextResponse } from 'next/server'
import { documentStore } from '@/lib/document-store'
import { getVectorStore } from '@/lib/vector-store'

export async function GET() {
  try {
    const store = await getVectorStore()
    const docs = await store.listDocuments()
    return NextResponse.json({ documents: docs })
  } catch {
    // Fallback to in-memory
    const docs = documentStore.getAll().map(d => ({
      id: d.id,
      name: d.name,
      type: d.type,
      size: d.size,
      chunks: d.chunks.length,
      uploadedAt: d.uploadedAt,
    }))
    return NextResponse.json({ documents: docs })
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json()
    await documentStore.delete(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
