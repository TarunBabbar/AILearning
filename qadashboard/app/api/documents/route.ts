import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, unauthorized } from "@/lib/session";
import { extractText } from "@/lib/file-parse";
import { chunkText } from "@/lib/rag/rag-chain";

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId(req);
  if (!userId) return unauthorized();

  try {
    const form = await req.formData();
    const files = form.getAll("files") as File[];
    const docs: any[] = [];

    for (const file of files) {
      const { text, type } = await extractText(file);
      const chunks = chunkText(text);

      const doc = await prisma.document.create({
        data: {
          userId,
          name: file.name,
          type,
          content: text,
          size: file.size,
        },
      });

      // Store chunks for retrieval
      await prisma.documentChunk.createMany({
        data: chunks.map((c, i) => ({
          documentId: doc.id,
          index: i,
          text: c,
        })),
      });

      docs.push({ id: doc.id, name: doc.name, type: doc.type, size: doc.size, chunkCount: chunks.length });
    }

    return Response.json({ count: docs.length, documents: docs });
  } catch (err) {
    console.error("[documents] upload failed:", err);
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId(req);
  if (!userId) return unauthorized();

  const docs = await prisma.document.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      type: true,
      size: true,
      summary: true,
      createdAt: true,
      _count: { select: { chunks: true } },
    },
  });

  const list = docs.map(({ _count, ...doc }) => ({
    ...doc,
    chunkCount: _count.chunks,
  }));

  return Response.json({ documents: list, total: list.length });
}
