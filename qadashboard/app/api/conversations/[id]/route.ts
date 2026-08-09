import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, unauthorized } from "@/lib/session";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId(req);
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    const conversation = await prisma.conversation.findFirst({
      where: { id, userId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!conversation) return Response.json({ error: "Conversation not found" }, { status: 404 });

    const messages = conversation.messages.map((m: { role: string; content: string; sources: unknown }) => ({
      role: m.role,
      content: m.content,
      sources: m.sources as { source: string; score: number }[] | null,
    }));

    return Response.json({ conversation: { ...conversation, messages } });
  } catch {
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId(req);
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    const conversation = await prisma.conversation.findFirst({ where: { id, userId } });
    if (!conversation) return Response.json({ error: "Conversation not found" }, { status: 404 });

    await prisma.conversation.delete({ where: { id } });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}
