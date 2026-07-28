import fs from "fs";
import path from "path";
import { config } from "dotenv";
config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const { parsePDF } = await import("../lib/rag/document-loader");

  const docsDir = path.resolve(process.cwd(), "docs");
  const files = fs.readdirSync(docsDir).filter(f => f.endsWith(".pdf")).sort();

  for (const file of files.slice(0, 3)) {
    const buffer = fs.readFileSync(path.join(docsDir, file));
    const parsed = await parsePDF(buffer, file);

    console.log(`\n===== ${file} =====`);
    console.log(`Pages: ${parsed.metadata.pageCount}`);
    console.log(`Total chars: ${parsed.metadata.totalChars}`);
    console.log(`\n--- First 2000 chars ---`);
    console.log(parsed.text.slice(0, 2000));
    console.log(`\n--- Last 2000 chars ---`);
    console.log(parsed.text.slice(-2000));
    console.log(`\n--- Sample middle (2000-4000) ---`);
    console.log(parsed.text.slice(2000, 4000));
  }
}

main().catch(console.error);
