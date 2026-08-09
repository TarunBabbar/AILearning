// Extract plain text from an uploaded File's buffer by extension.
export async function extractText(file: File): Promise<{ text: string; type: string }> {
  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (name.endsWith(".pdf")) {
    return { text: await parsePdf(buffer), type: "pdf" };
  }
  if (name.endsWith(".docx")) {
    return { text: await parseDocx(buffer), type: "docx" };
  }
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    return { text: parseXlsx(buffer), type: name.endsWith(".xlsx") ? "xlsx" : "xls" };
  }
  // txt / md / csv / everything else — decode as text
  return { text: buffer.toString("utf-8"), type: name.split(".").pop() || "txt" };
}

async function parsePdf(buffer: Buffer): Promise<string> {
  // pdf-parse requires a data-buffer file; this works on Node 18+
  const pdfParse = (await import("pdf-parse")).default;
  const result = await pdfParse(buffer);
  return result.text || "";
}

async function parseDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value || "";
}

function parseXlsx(buffer: Buffer): string {
  // xlsx is CJS; load via require-like interop
  const XLSX = require("xlsx") as typeof import("xlsx");
  const wb = XLSX.read(buffer, { type: "buffer" });
  const out: string[] = [];
  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[sheetName], {
      header: 1,
      defval: "",
    });
    for (const row of rows) {
      if (row && row.length > 0) out.push(row.join(" | "));
    }
  }
  return out.join("\n");
}

export function getFileType(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "txt";
  return ext;
}
