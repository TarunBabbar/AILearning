import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, unauthorized } from "@/lib/session";

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId(req);
  if (!userId) return unauthorized();

  const { searchParams } = new URL(req.url);
  const module = searchParams.get("module");

  const conversations = await prisma.conversation.findMany({
    where: { userId, ...(module ? { module } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { _count: { select: { messages: true } } },
  });

  const list = conversations.map((c: { _count: { messages: number } } & Record<string, unknown>) => {
    const { _count, ...rest } = c;
    return { ...rest, messageCount: _count.messages };
  });

  return Response.json({ conversations: list });
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId(req);
  if (!userId) return unauthorized();

  try {
    const { module, title } = await req.json();
    if (!module) return Response.json({ error: "module required" }, { status: 400 });

    const conversation = await prisma.conversation.create({
      data: { userId, module: String(module), title: title || null },
    });
    return Response.json({ conversation }, { status: 201 });
  } catch {
    return Response.json({ error: "Failed to create" }, { status: 500 });
  }
}
