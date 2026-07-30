import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function extractTextFromFile(
  file: File
): Promise<{ text: string; type: string }> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".csv")) {
    return { text: await file.text(), type: name.split(".").pop() || "txt" };
  }

  if (name.endsWith(".pdf")) {
    // PDF parsing happens server-side; return the raw text from server
    const buffer = await file.arrayBuffer();
    return { text: new TextDecoder().decode(buffer), type: "pdf" };
  }

  if (name.endsWith(".docx")) {
    // DOCX parsing happens server-side with mammoth
    const buffer = await file.arrayBuffer();
    return { text: new TextDecoder().decode(buffer), type: "docx" };
  }

  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    return { text: await file.text(), type: "xlsx" };
  }

  return { text: await file.text(), type: "txt" };
}
