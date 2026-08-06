"use client";

/**
 * Extract plain text from a PDF File using pdfjs-dist in the browser.
 * pdfjs-dist is loaded lazily (dynamic import) so it is never evaluated
 * on the server during prerendering — the module references browser-only
 * globals like DOMMatrix.
 */
export async function extractPdfText(file: File, maxPages = 50): Promise<string> {
  const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");

  GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@6.2.108/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const task = getDocument({ data: arrayBuffer });
  const doc = await task.promise;

  const pages = Math.min(doc.numPages, maxPages);
  const parts: string[] = [];

  for (let p = 1; p <= pages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const strings = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .filter(Boolean);
    parts.push(strings.join(" "));
  }

  await task.destroy();
  return parts.join("\n\n");
}

/**
 * Extract text from a DOCX file using mammoth in the browser.
 */
export async function extractDocxText(file: File): Promise<string> {
  const { extractRawText } = await import("mammoth/mammoth.browser");
  const arrayBuffer = await file.arrayBuffer();
  const result = await extractRawText({ arrayBuffer });
  return (result.value || "").trim();
}

export async function extractFileText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return extractPdfText(file);
  if (name.endsWith(".docx")) return extractDocxText(file);
  if (name.endsWith(".txt") || name.endsWith(".md")) {
    return file.text();
  }
  throw new Error(`Unsupported file type: ${file.name}`);
}
