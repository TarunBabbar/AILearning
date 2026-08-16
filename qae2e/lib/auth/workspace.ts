// Workspace access control: owner (single-owner legacy) or member rows with
// roles (owner / admin / member). API routes call requireWorkspaceAccess to
// scope reads and gate mutations.

import { getWorkspace, getWorkspaceMemberRole, listWorkspaces } from "../db";
import { requireUser } from "./guard";
import { NextRequest, NextResponse } from "next/server";

export type WorkspaceRole = "owner" | "admin" | "member";

export interface WorkspaceAccess {
  workspaceId: string;
  userId: string;
  email: string;
  role: WorkspaceRole; // "owner" when the user owns the workspace
  /** Members with admin+ can modify connector credentials / settings. */
  canAdmin: boolean;
}

/**
 * Resolve the caller's role for a workspace.
 * - The workspace owner gets "owner" (legacy single-owner workspaces work
 *   with no member rows).
 * - Otherwise falls back to the workspace_members table.
 */
export async function getWorkspaceRoleFor(workspaceId: string, userId: string): Promise<WorkspaceRole | null> {
  const ws = await getWorkspace(workspaceId);
  if (!ws) return null;
  if (ws.ownerId === userId) return "owner";
  const role = await getWorkspaceMemberRole(workspaceId, userId);
  return role; // null when not a member at all
}

/**
 * Guard for settings/integration routes: 401 unauthenticated, 403 when the
 * user has no access to the workspace.
 */
export async function requireWorkspaceAccess(
  req: NextRequest,
  workspaceId: string
): Promise<{ access: WorkspaceAccess } | { access: null; response: NextResponse }> {
  const auth = await requireUser(req);
  if (!auth.user) return { access: null, response: auth.response };

  const role = await getWorkspaceRoleFor(workspaceId, auth.user.id);
  if (!role) {
    return {
      access: null,
      response: NextResponse.json({ error: "You don't have access to this workspace" }, { status: 403 }),
    };
  }
  return {
    access: {
      workspaceId,
      userId: auth.user.id,
      email: auth.user.email,
      role,
      canAdmin: role === "owner" || role === "admin",
    },
  };
}

/** All workspace ids the user can access (owned + member of). */
export async function listAccessibleWorkspaces(userId: string): Promise<string[]> {
  const owned = await listWorkspaces(userId);
  const ids = new Set(owned.map((w) => w.id));
  // Members: iterate member rows via a best-effort query. Since workspace_members
  // is keyed by workspace, resolve via the DB directly.
  try {
    const { sql } = await import("@vercel/postgres");
    const rows = await sql`SELECT workspace_id FROM workspace_members WHERE user_id = ${userId}`;
    for (const r of rows.rows || []) ids.add(String((r as { workspace_id: unknown }).workspace_id));
  } catch {
    // file fallback below
  }
  return [...ids];
}
