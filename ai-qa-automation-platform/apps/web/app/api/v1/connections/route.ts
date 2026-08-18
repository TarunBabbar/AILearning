import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { encryptSecret } from "@/lib/secrets";
import { requireAuth } from "@/lib/auth-helpers";

export async function GET() {
  const { workspaceId } = await requireAuth();
  const connections = await prisma.connection.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(
    connections.map((c) => ({
      id: c.id,
      type: c.type,
      status: c.status,
      scope_config: c.scopeConfig,
      expires_at: c.expiresAt?.toISOString() ?? null,
    }))
  );
}

export async function POST(req: NextRequest) {
  const { workspaceId } = await requireAuth();
  const body = await req.json();
  const { type, secret, scope_config = {} } = body as {
    type: string;
    secret: string;
    scope_config?: object;
  };

  if (!["github", "jira", "database"].includes(type)) {
    return NextResponse.json({ detail: "Unsupported connector type" }, { status: 400 });
  }

  const conn = await prisma.connection.create({
    data: {
      workspaceId,
      type,
      status: "connected",
      secretCiphertext: encryptSecret(secret),
      scopeConfig: scope_config as Prisma.InputJsonValue,
    },
  });
  return NextResponse.json(
    { id: conn.id, type: conn.type, status: conn.status, scope_config: conn.scopeConfig },
    { status: 201 }
  );
}
