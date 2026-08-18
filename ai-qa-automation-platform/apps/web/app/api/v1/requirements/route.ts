import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";

export async function GET() {
  const { workspaceId } = await requireAuth();
  const requirements = await prisma.requirement.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(
    requirements.map((r) => ({
      id: r.id,
      source_key: r.sourceKey,
      title: r.title,
      risk_tier: r.riskTier,
      source_link: r.sourceLink,
    }))
  );
}

export async function POST(req: NextRequest) {
  const { workspaceId } = await requireAuth();
  const body = await req.json();
  const {
    source_key,
    title,
    description,
    acceptance_criteria = [],
    source_link,
    risk_tier = "medium",
  } = body as {
    source_key: string;
    title: string;
    description?: string;
    acceptance_criteria?: string[];
    source_link?: string;
    risk_tier?: string;
  };

  if (!source_key || !title) {
    return NextResponse.json({ detail: "source_key and title required" }, { status: 400 });
  }

  const created = await prisma.requirement.create({
    data: {
      workspaceId,
      sourceKey: source_key,
      title,
      description: description ?? undefined,
      acceptanceCriteria: acceptance_criteria,
      sourceLink: source_link ?? undefined,
      riskTier: risk_tier,
    },
  });
  return NextResponse.json(
    {
      id: created.id,
      source_key: created.sourceKey,
      title: created.title,
      risk_tier: created.riskTier,
      source_link: created.sourceLink,
    },
    { status: 201 }
  );
}
