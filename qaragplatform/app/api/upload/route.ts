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

    // Extract text based on file type
    let text: string
    const ext = file.name.split('.').pop()?.toLowerCase()

    if (ext === 'docx') {
      const mammoth = require('mammoth')
      const buffer = Buffer.from(await file.arrayBuffer())
      const result = await mammoth.extractRawText({ buffer })
      text = result.value
    } else if (ext === 'xlsx' || ext === 'xls') {
      const XLSX = require('xlsx')
      const buffer = Buffer.from(await file.arrayBuffer())
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const sheets: string[] = []
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName]
        const csv = XLSX.utils.sheet_to_csv(sheet)
        if (csv.trim()) {
          sheets.push(`--- ${sheetName} ---\n${csv}`)
        }
      }
      text = sheets.join('\n\n')
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
