import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const { workspaceId } = await requireAuth();
  const status = req.nextUrl.searchParams.get("status");
  const cases = await prisma.testCase.findMany({
    where: { workspaceId, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(
    cases.map((t) => ({
      id: t.id,
      title: t.title,
      test_type: t.testType,
      status: t.status,
      source: t.source,
      derived_from: t.derivedFrom,
      priority: t.priority,
      tags: t.tags,
      code: t.code,
    }))
  );
}

export async function POST(req: NextRequest) {
  const { workspaceId } = await requireAuth();
  const body = await req.json();
  const { title, test_type, derived_from, code, tags = [], priority = "P2" } = body as {
    title: string;
    test_type: string;
    derived_from?: string;
    code?: string;
    tags?: string[];
    priority?: string;
  };

  if (!title || !test_type) {
    return NextResponse.json({ detail: "title and test_type required" }, { status: 400 });
  }

  const tc = await prisma.testCase.create({
    data: {
      workspaceId,
      title,
      testType: test_type,
      status: "approved",
      source: "user-provided",
      derivedFrom: derived_from ?? undefined,
      code: code ?? undefined,
      tags,
      priority,
    },
  });
  return NextResponse.json({ ok: true, id: tc.id }, { status: 201 });
}
