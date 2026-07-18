import { NextRequest, NextResponse } from 'next/server'
import { documentStore } from '@/lib/document-store'
import { chunkText } from '@/lib/rag'
import { generateId } from '@/lib/utils'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const sources = JSON.parse((formData.get('sources') as string) || '[]')
    const files = formData.getAll('files') as File[]

    let totalDocs = 0
    let totalChunks = 0

    for (const file of files) {
      let text: string
      if (file.name.endsWith('.docx')) {
        const mammoth = require('mammoth')
        const buffer = Buffer.from(await file.arrayBuffer())
        const result = await mammoth.extractRawText({ buffer })
        text = result.value
      } else {
        text = await file.text()
      }
      if (!text || !text.trim()) continue
      const chunks = chunkText(text)

      const doc = {
        id: generateId(),
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        content: text,
        chunks,
        uploadedAt: new Date(),
      }

      await documentStore.add(doc)
      totalDocs++
      totalChunks += chunks.length
    }

    return NextResponse.json({
      success: true,
      migration: {
        id: generateId(),
        sources,
        filesProcessed: totalDocs,
        totalChunks,
        status: 'completed',
        timestamp: new Date().toISOString(),
      },
      summary: `Migrated ${totalDocs} document${totalDocs !== 1 ? 's' : ''} (${totalChunks} chunk${totalChunks !== 1 ? 's' : ''}) from ${sources.length + (files.length > 0 ? 1 : 0)} source${sources.length + (files.length > 0 ? 1 : 0) !== 1 ? 's' : ''}.`
    })
  } catch (err) {
    return NextResponse.json({ error: 'Migration failed: ' + (err as Error).message }, { status: 500 })
  }
}
