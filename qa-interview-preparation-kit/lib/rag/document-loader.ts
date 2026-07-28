import fs from "fs";
import path from "path";

interface PDFPage {
  text: string;
  pageNumber?: number;
}

export interface ParsedDocument {
  text: string;
  pages: PDFPage[];
  metadata: {
    fileName: string;
    pageCount: number;
    totalChars: number;
  };
}

/**
 * Parse a PDF file buffer into text.
 * Uses pdf-parse (pdf.js under the hood) — works server-side in Node.js.
 */
export async function parsePDF(
  buffer: Buffer,
  fileName: string
): Promise<ParsedDocument> {
  const pdfParse = (await import("pdf-parse")).default;

  const data = await pdfParse(buffer);
  const text = data.text;

  const pages: PDFPage[] = [];
  if (text) {
    pages.push({ text, pageNumber: 1 });
  }

  return {
    text,
    pages,
    metadata: {
      fileName,
      pageCount: data.numpages || 1,
      totalChars: text.length,
    },
  };
}

/**
 * Parse a DOCX file buffer into text.
 * Uses mammoth — extracts clean text from Word documents.
 */
export async function parseDOCX(
  buffer: Buffer,
  fileName: string
): Promise<ParsedDocument> {
  const mammoth = await import("mammoth");

  const result = await mammoth.extractRawText({ buffer });
  const text = result.value || "";

  const pages: PDFPage[] = [];
  if (text) {
    pages.push({ text, pageNumber: 1 });
  }

  return {
    text,
    pages,
    metadata: {
      fileName,
      pageCount: 1,
      totalChars: text.length,
    },
  };
}

/**
 * Read a PDF file from disk (used by seed script).
 */
export async function readPDFFromFile(
  filePath: string
): Promise<ParsedDocument> {
  const buffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  return parsePDF(buffer, fileName);
}
