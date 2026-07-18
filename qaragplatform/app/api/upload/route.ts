import { NextRequest, NextResponse } from 'next/server'
import { documentStore } from '@/lib/document-store'
import { chunkText } from '@/lib/rag'
import { generateId } from '@/lib/utils'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Extract text: .docx files need special handling
    let text: string
    if (file.name.endsWith('.docx')) {
      const mammoth = require('mammoth')
      const buffer = Buffer.from(await file.arrayBuffer())
      const result = await mammoth.extractRawText({ buffer })
      text = result.value
    } else {
      text = await file.text()
    }

    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'No readable text found in file' }, { status: 400 })
    }

    const chunks = chunkText(text)
    const docId = generateId()

    const doc = {
      id: docId,
      name: file.name,
      type: file.type || 'text/plain',
      size: file.size,
      content: text,
      chunks,
      uploadedAt: new Date(),
    }

    documentStore.add(doc)

    return NextResponse.json({
      success: true,
      document: {
        id: doc.id,
        name: doc.name,
        type: doc.type,
        size: doc.size,
        chunks: doc.chunks.length,
        uploadedAt: doc.uploadedAt,
      }
    })
  } catch (err) {
    return NextResponse.json({ error: 'Upload failed: ' + (err as Error).message }, { status: 500 })
  }
}
