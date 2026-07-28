/**
 * Extract text from image-based PDFs using OCR.
 * Processes one PDF at a time. Run with PDF number as arg.
 *
 * Usage: npx tsx scripts/extract-to-docx.ts [pdfNumber]
 *   npx tsx scripts/extract-to-docx.ts          # Extract all
 *   npx tsx scripts/extract-to-docx.ts 3         # Extract only PDF 3
 *
 * Requires: npm install tesseract.js pdf-to-img docx canvas
 */

import fs from "fs";
import path from "path";
import Tesseract from "tesseract.js";
import { pdf } from "pdf-to-img";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

const IMAGE_PDFS = [3, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const DOCS_DIR = path.resolve(process.cwd(), "docs");

async function ocrImage(imageBuffer: Buffer): Promise<string> {
  const result = await Tesseract.recognize(imageBuffer, "eng", {
    logger: (info: any) => {
      if (info.status === "recognizing text") {
        const pct = Math.round(info.progress * 100);
        if (pct % 10 === 0 && pct < 100)
          process.stdout.write(`\r    OCR progress: ${pct}%`);
        if (pct >= 100)
          process.stdout.write(`\r    OCR progress: complete\n`);
      }
    },
  });
  return result.data.text;
}

async function extractPDF(pdfPath: string, fileName: string): Promise<void> {
  const baseName = path.basename(fileName, ".pdf");
  const outPath = path.join(DOCS_DIR, `${baseName}.docx`);

  // Skip if already exists
  if (fs.existsSync(outPath)) {
    console.log(`  ⏭ Already exists, skipping`);
    return;
  }

  const doc = await pdf(pdfPath, { scale: 2 });
  const totalPages = doc.length;

  console.log(`\n📄 ${fileName} (${totalPages} pages):`);
  const allText: string[] = [];
  let pageNum = 0;

  for await (const pageImage of doc) {
    pageNum++;
    process.stdout.write(`  Page ${pageNum}/${totalPages} — OCR...`);
    const text = await ocrImage(pageImage as Buffer);
    allText.push(text);
    console.log(`  ✅ (${text.length} chars)`);

    // Save incrementally every 10 pages
    if (pageNum % 10 === 0 || pageNum === totalPages) {
      const partialDoc = new Document({
        title: baseName,
        sections: [
          {
            children: allText.flatMap((pageText, idx) => [
              new Paragraph({
                children: [new TextRun({ text: `Page ${idx + 1}`, bold: true, size: 24 })],
                spacing: { before: 400 },
              }),
              ...pageText
                .split("\n")
                .filter((l) => l.trim())
                .map(
                  (line) =>
                    new Paragraph({
                      children: [new TextRun({ text: line.trim(), size: 20 })],
                      spacing: { after: 120 },
                    })
                ),
            ]),
          },
        ],
      });
      const buffer = await Packer.toBuffer(partialDoc);
      fs.writeFileSync(outPath, buffer);
      console.log(`  💾 Saved checkpoint (page ${pageNum}/${totalPages})`);
    }
  }

  doc.destroy();
  console.log(`✅ Complete: ${outPath}`);
}

async function main() {
  const targetIdx = process.argv[2] ? parseInt(process.argv[2]) : null;

  const pdfFiles = fs
    .readdirSync(DOCS_DIR)
    .filter((f) => f.endsWith(".pdf"))
    .sort();

  const toExtract = pdfFiles.filter((f) => {
    const match = f.match(/^(\d+)\./);
    return match && IMAGE_PDFS.includes(parseInt(match[1])) && (targetIdx === null || parseInt(match[1]) === targetIdx);
  });

  if (toExtract.length === 0) {
    console.log(targetIdx ? `PDF ${targetIdx} not found or not in image list.` : "No matching PDFs.");
    return;
  }

  console.log(`Processing ${toExtract.length} PDF(s):`);
  for (const f of toExtract) console.log(`  ${f}`);

  for (const fileName of toExtract) {
    const filePath = path.join(DOCS_DIR, fileName);
    try {
      await extractPDF(filePath, fileName);
    } catch (err: any) {
      console.error(`  ❌ ${fileName}: ${err.message}`);
    }
  }

  console.log("\n=== Done ===");
}

main().catch(console.error);
