import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, unauthorized } from "@/lib/session";

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId(req);
  if (!userId) return unauthorized();

  const projects = await prisma.project.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { testCases: true } } },
  });

  const list = projects.map((p: { _count: { testCases: number } }) => {
    const { _count, ...rest } = p;
    return { ...rest, testCases: _count.testCases };
  });

  return Response.json({ projects: list });
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId(req);
  if (!userId) return unauthorized();

  try {
    const { name, description, jiraUrl } = await req.json();
    if (!name) return Response.json({ error: "Name required" }, { status: 400 });

    const project = await prisma.project.create({
      data: { userId, name, description: description || null, jiraUrl: jiraUrl || null },
    });
    return Response.json({ ...project, testCases: 0 });
  } catch {
    return Response.json({ error: "Failed to create" }, { status: 500 });
  }
}
