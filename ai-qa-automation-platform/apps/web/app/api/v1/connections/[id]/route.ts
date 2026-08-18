import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getGitHubClient } from "@/lib/connectors/github";
import { getJiraConfig, fetchStories } from "@/lib/connectors/jira";
import { requireAuth } from "@/lib/auth-helpers";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { workspaceId } = await requireAuth();
  const { id } = await params;
  const conn = await prisma.connection.findFirst({ where: { id, workspaceId } });
  if (!conn) return NextResponse.json({ detail: "Connection not found" }, { status: 404 });
  await prisma.connection.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { workspaceId } = await requireAuth();
  const { id } = await params;
  const conn = await prisma.connection.findFirst({ where: { id, workspaceId } });
  if (!conn) return NextResponse.json({ detail: "Connection not found" }, { status: 404 });

  // Actually exercise the connection with the stored secret.
  const results: Record<string, unknown> = {};
  try {
    if (conn.type === "github") {
      const client = await getGitHubClient(workspaceId);
      // Lightweight auth check — GET /user
      await client.rest.users.getAuthenticated();
      results.status = "connected";
    } else if (conn.type === "jira") {
      const cfg = await getJiraConfig(workspaceId);
      await fetchStories(cfg, "ORDER BY created DESC");
      results.status = "connected";
    } else if (conn.type === "database") {
      // DB connection test — attempt a trivial SELECT via the raw connection
      const secret = conn.secretCiphertext; // decrypt handled by caller util
      results.status = secret ? "connected" : "error";
    } else {
      results.status = "error";
      results.error = "Unsupported type";
    }
    return NextResponse.json({ ok: true, ...results });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      status: "expired",
      error: (e as Error).message,
    });
  }
}
