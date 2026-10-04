import { NextRequest, NextResponse } from 'next/server'
import { documentStore } from '@/lib/document-store'
import { chunkText } from '@/lib/rag'
import { extractText, UnsupportedFileError } from '@/lib/extract'
import { SUPPORTED_LABEL, extensionOf } from '@/lib/formats'
import { generateId } from '@/lib/utils'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_BYTES = 25 * 1024 * 1024

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is ${MAX_BYTES / 1024 / 1024} MB.` },
        { status: 413 },
      )
    }

    let text: string
    try {
      text = await extractText(file)
    } catch (err) {
      if (err instanceof UnsupportedFileError) {
        return NextResponse.json({ error: err.message }, { status: 415 })
      }
      throw err
    }

    if (!text.trim()) {
      return NextResponse.json(
        { error: `No readable text found in "${file.name}". If it is a scanned PDF it needs OCR first. Supported: ${SUPPORTED_LABEL}.` },
        { status: 400 },
      )
    }

    const chunks = chunkText(text)
    const docId = generateId()
    const doc = {
      id: docId,
      name: file.name,
      type: file.type || `application/${extensionOf(file.name) || 'octet-stream'}`,
      size: file.size,
      content: text,
      chunks,
      uploadedAt: new Date(),
    }

    await documentStore.add(doc)

    return NextResponse.json({
      success: true,
      document: {
        id: doc.id,
        name: doc.name,
        type: doc.type,
        size: doc.size,
        chunks: doc.chunks.length,
        characters: text.length,
        uploadedAt: doc.uploadedAt,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: 'Upload failed: ' + (err as Error).message }, { status: 500 })
  }
}
