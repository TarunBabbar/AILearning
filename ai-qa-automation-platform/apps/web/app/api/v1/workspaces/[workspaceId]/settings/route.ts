import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const ctx = await requireAuth();
  const { workspaceId } = await params;
  if (workspaceId !== ctx.workspaceId) {
    return NextResponse.json({ detail: "Cross-workspace access denied" }, { status: 403 });
  }

  let settings = await prisma.workspaceSettings.findUnique({ where: { workspaceId } });
  if (!settings) {
    settings = await prisma.workspaceSettings.create({
      data: { workspaceId, thresholds: {}, riskTiers: {}, gatePolicy: {} },
    });
  }
  return NextResponse.json({
    thresholds: settings.thresholds,
    risk_tiers: settings.riskTiers,
    gate_policy: settings.gatePolicy,
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const ctx = await requireAuth();
  const { workspaceId } = await params;
  if (workspaceId !== ctx.workspaceId) {
    return NextResponse.json({ detail: "Cross-workspace access denied" }, { status: 403 });
  }

  const body = await req.json();
  const { thresholds, risk_tiers, gate_policy } = body as {
    thresholds?: object;
    risk_tiers?: object;
    gate_policy?: object;
  };

  const existing = await prisma.workspaceSettings.findUnique({ where: { workspaceId } });
  const settings = existing
    ? await prisma.workspaceSettings.update({
        where: { workspaceId },
        data: {
          ...(thresholds ? { thresholds } : {}),
          ...(risk_tiers ? { riskTiers: risk_tiers } : {}),
          ...(gate_policy ? { gatePolicy: gate_policy } : {}),
        },
      })
    : await prisma.workspaceSettings.create({
        data: {
          workspaceId,
          thresholds: thresholds ?? {},
          riskTiers: risk_tiers ?? {},
          gatePolicy: gate_policy ?? {},
        },
      });

  return NextResponse.json({
    thresholds: settings.thresholds,
    risk_tiers: settings.riskTiers,
    gate_policy: settings.gatePolicy,
  });
}
