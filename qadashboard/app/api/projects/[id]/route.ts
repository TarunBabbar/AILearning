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
    const project = await prisma.project.findFirst({ where: { id, userId } });
    if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

    await prisma.project.delete({ where: { id } });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}
