import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { workspaceId } = await requireAuth();
  const { id } = await params;
  const body = await req.json();
  const { action, code, title } = body as {
    action: string;
    code?: string;
    title?: string;
  };

  const tc = await prisma.testCase.findFirst({ where: { id, workspaceId } });
  if (!tc) return NextResponse.json({ detail: "Test case not found" }, { status: 404 });

  if (action === "approve") {
    await prisma.testCase.update({ where: { id }, data: { status: "approved" } });
  } else if (action === "reject") {
    await prisma.testCase.update({ where: { id }, data: { status: "rejected" } });
  } else if (action === "edit") {
    await prisma.testCase.update({
      where: { id },
      data: { status: "approved", ...(code !== undefined ? { code } : {}), ...(title !== undefined ? { title } : {}) },
    });
  } else {
    return NextResponse.json({ detail: "Unknown action" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
