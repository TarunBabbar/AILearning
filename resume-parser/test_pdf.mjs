import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import pdfParse from 'pdf-parse';

async function extractPdfText(filePath) {
  const buf = fs.readFileSync(filePath);
  const data = await pdfParse(buf);
  return (data.text || '').trim();
}

async function testPdf() {
  try {
    const text = await extractPdfText('6+ Years - 20-July.pdf');
    console.log('PDF text length:', text.length);
    console.log('First 500 chars:', text.substring(0, 500));
    console.log('Last 500 chars:', text.substring(Math.max(0, text.length - 500)));
  } catch (e) {
    console.error('Error reading PDF:', e.message);
  }
}

testPdf();