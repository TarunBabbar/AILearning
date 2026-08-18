import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth";

/**
 * Server-side auth + workspace context for route handlers.
 * The session carries the workspaceId claim; route handlers validate
 * membership against workspace_members on every request.
 */
export async function authContext() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return { user: null, workspaceId: null, role: null };
  }
  return {
    user: session.user,
    workspaceId: session.workspaceId ?? null,
    role: session.role ?? null,
  };
}

export interface AuthSession {
  user: { id?: string; email?: string | null; name?: string | null; image?: string | null };
  workspaceId: string;
  role: string;
}

export async function requireAuth(): Promise<AuthSession> {
  const ctx = await authContext();
  if (!ctx.user || !ctx.workspaceId) {
    const error = new Error("Unauthorized") as Error & { status?: number };
    error.status = 401;
    throw error;
  }
  return {
    user: ctx.user,
    workspaceId: ctx.workspaceId,
    role: ctx.role ?? "qa",
  };
}
