import { NextRequest } from "next/server";
import { v4 as uuid } from "uuid";

const globalDocs = globalThis as unknown as { __docs?: any[] };
if (!globalDocs.__docs) globalDocs.__docs = [];

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const files = form.getAll("files") as File[];
    const docs: any[] = [];

    for (const file of files) {
      const text = await file.text();
      const doc = {
        id: uuid(),
        name: file.name,
        type: file.name.split(".").pop() || "txt",
        content: text,
        size: file.size,
        createdAt: new Date().toISOString(),
      };
      globalDocs.__docs!.push(doc);
      docs.push(doc);
    }

    return Response.json({ count: docs.length, documents: docs });
  } catch (err) {
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function GET() {
  const docs = (globalDocs.__docs || []).map(({ content, ...rest }: any) => rest);
  return Response.json({ documents: docs, total: docs.length });
}
