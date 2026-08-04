// POST /api/upload — upload an image (requirement screenshot), save it to the
// store, and extract text via a free vision model. Returns extracted text.

import { NextRequest } from "next/server";
import { insertOne, withWorkspace } from "@/lib/store";
import { extractTextFromImage } from "@/lib/vision";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const requirementId = String(form?.get("requirementId") || "");
  const workspaceId = String(form?.get("workspaceId") || "");
  if (!file || typeof file === "string") {
    return Response.json({ error: "file required" }, { status: 400 });
  }
  const buf = Buffer.from(await (file as Blob).arrayBuffer());
  const mime = (file as File).type || "image/png";

  const id = crypto.randomUUID();
  await withWorkspace(workspaceId, async () => {
    await insertOne("uploads", {
      id,
      requirementId,
      mime,
      size: buf.length,
      base64: buf.toString("base64"),
      createdAt: new Date().toISOString(),
    });
  });

  try {
    const text = await extractTextFromImage(buf.toString("base64"), mime);
    await withWorkspace(workspaceId, async () => {
      await insertOne("extractions", {
        id: crypto.randomUUID(),
        uploadId: id,
        requirementId,
        text,
        createdAt: new Date().toISOString(),
      });
    });
    return Response.json({ ok: true, id, text });
  } catch (err) {
    return Response.json({ ok: false, id, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
