/**
 * Text extraction for every upload format, so the upload route stays a thin
 * HTTP handler:
 *
 *   pdf                     pdf-parse
 *   docx                    mammoth
 *   xlsx / xls              xlsx (one CSV block per sheet)
 *   txt md csv json html…   decoded as UTF-8, markup stripped from HTML
 *
 * Formats we cannot read (legacy .doc, .pptx, images, scans) fail with a clear
 * message rather than silently indexing binary noise.
 */

import { extensionOf, isSupported, TEXT_EXTENSIONS, SUPPORTED_LABEL } from './formats'

export class UnsupportedFileError extends Error {}

export async function extractText(file: File): Promise<string> {
  const ext = extensionOf(file.name)
  const buffer = Buffer.from(await file.arrayBuffer())

  if (ext === 'pdf') return extractPdf(buffer)
  if (ext === 'docx') return extractDocx(buffer)
  if (ext === 'xlsx' || ext === 'xls') return extractWorkbook(buffer)

  const decoded = decodeText(buffer, ext)
  if (TEXT_EXTENSIONS.has(ext)) return decoded
  if (ext && !isSupported(file.name)) {
    throw new UnsupportedFileError(`".${ext}" is not supported. Use ${SUPPORTED_LABEL}.`)
  }
  if (looksBinary(decoded)) {
    throw new UnsupportedFileError(`Could not read "${file.name}" as text. Use ${SUPPORTED_LABEL}.`)
  }
  return decoded
}

async function extractPdf(buffer: Buffer): Promise<string> {
  // Require the inner module: the package entry point runs a debug block that
  // tries to read a sample file on import.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pdfParse = require('pdf-parse/lib/pdf-parse.js')
  const data = await pdfParse(buffer)
  return String(data.text || '').trim()
}

async function extractDocx(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mammoth = require('mammoth')
  const result = await mammoth.extractRawText({ buffer })
  return String(result.value || '').trim()
}

function extractWorkbook(buffer: Buffer): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const XLSX = require('xlsx')
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheets: string[] = []
  for (const name of workbook.SheetNames) {
    const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[name])
    if (csv.trim()) sheets.push(`--- ${name} ---\n${csv}`)
  }
  return sheets.join('\n\n').trim()
}

function decodeText(buffer: Buffer, ext: string): string {
  let text = buffer.toString('utf8').replace(/^\uFEFF/, '')
  if (ext === 'html' || ext === 'htm') {
    text = text
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  }
  return text.replace(/\u0000/g, '').replace(/\r\n/g, '\n').replace(/[ \t]{2,}/g, ' ').trim()
}

function looksBinary(text: string): boolean {
  if (!text) return true
  const sample = text.slice(0, 2000)
  const control = (sample.match(/[\u0000-\u0008\u000E-\u001F]/g) || []).length
  return control / sample.length > 0.05
}
