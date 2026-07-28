import fs from "fs";
import path from "path";
import { config } from "dotenv";
config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const mammoth = await import("mammoth");
  const docsDir = path.resolve(process.cwd(), "docs");
  const files = fs.readdirSync(docsDir).filter(f => f.endsWith(".docx")).sort();

  for (const file of files) {
    const buffer = fs.readFileSync(path.join(docsDir, file));
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value || "";
    console.log(`\n===== ${file} (${text.length} chars) =====`);
    console.log(text.slice(0, 500));
    if (text.length > 500) console.log("...");
  }
}

main().catch(console.error);
