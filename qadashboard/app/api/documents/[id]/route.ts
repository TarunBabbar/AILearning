import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, unauthorized } from "@/lib/session";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId(req);
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    const doc = await prisma.document.findFirst({ where: { id, userId } });
    if (!doc) return Response.json({ error: "Document not found" }, { status: 404 });

    // Cascade deletes DocumentChunk rows via relation
    await prisma.document.delete({ where: { id } });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}
