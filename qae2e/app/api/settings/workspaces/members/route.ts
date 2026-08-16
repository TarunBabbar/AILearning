import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import {
  addWorkspaceMember,
  getUserByEmail,
  listWorkspaces,
  listWorkspaceMembers,
  removeWorkspaceMember,
} from "@/lib/db";

export const runtime = "nodejs";

// POST /api/settings/workspaces/members — invite a user by email
//   { workspaceId, email, role?: "member" | "admin" }
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.user) return auth.response;
  const body = await req.json().catch(() => null);
  const workspaceId = String(body?.workspaceId || "");
  const email = String(body?.email || "").trim().toLowerCase();
  const role = body?.role === "admin" ? "admin" : "member";

  if (!workspaceId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "workspaceId and a valid email are required" }, { status: 400 });
  }
  const owned = (await listWorkspaces(auth.user.id)).find((w) => w.id === workspaceId);
  if (!owned) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const target = await getUserByEmail(email);
  if (!target) {
    return NextResponse.json(
      { error: "No account with that email — invite them to sign up first" },
      { status: 404 }
    );
  }
  if (String(target.id) === auth.user.id) {
    return NextResponse.json({ error: "You already own this workspace" }, { status: 400 });
  }

  await addWorkspaceMember(workspaceId, String(target.id), role);
  const members = await listWorkspaceMembers(workspaceId);
  return NextResponse.json({ ok: true, members });
}

// DELETE /api/settings/workspaces/members — remove a member
//   { workspaceId, userId }
export async function DELETE(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.user) return auth.response;
  const body = await req.json().catch(() => null);
  const workspaceId = String(body?.workspaceId || "");
  const userId = String(body?.userId || "");

  const owned = (await listWorkspaces(auth.user.id)).find((w) => w.id === workspaceId);
  if (!owned) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  if (userId === auth.user.id) {
    return NextResponse.json({ error: "You can't remove yourself as owner" }, { status: 400 });
  }

  await removeWorkspaceMember(workspaceId, userId);
  const members = await listWorkspaceMembers(workspaceId);
  return NextResponse.json({ ok: true, members });
}
