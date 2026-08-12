// User-aware action logging for API routes. Every log line identifies WHO
// performed the action (email + id) so you can trace a user's journey through
// the app: login, resume upload, scoring, viewing matches, chat, contacts.
// Logs go to the server console (dev + prod).
import { prisma } from "@/lib/db";

export type ActionLogUser = { id: string; email: string; name?: string | null };

/**
 * Resolve a logged-in user's identity from just their userId (the common
 * case in authenticated routes that only have getSessionUserId()).
 */
export async function getUserForLog(
  userId: string | null
): Promise<ActionLogUser | null> {
  if (!userId) return null;
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });
  return u ? { id: u.id, email: u.email, name: u.name } : null;
}

function fmtUser(u: ActionLogUser | null | undefined): string {
  if (!u) return "user=anonymous";
  const who = u.name ? `${u.name} <${u.email}>` : u.email;
  return `user=${who} (${u.id})`;
}

/** Log a user action with the actor's identity, e.g. login, resume upload. */
export function logUserAction(
  user: ActionLogUser | null | undefined,
  action: string,
  detail?: string
): void {
  const line = `[${new Date().toISOString()}] [${action}] ${fmtUser(user)}${
    detail ? ` — ${detail}` : ""
  }`;
  console.log(line);
}

/** Log a failed/blocked user action (auth failure, error, validation). */
export function logUserActionError(
  user: ActionLogUser | null | undefined,
  action: string,
  detail?: string
): void {
  const line = `[${new Date().toISOString()}] [${action}] ${fmtUser(user)}${
    detail ? ` — ${detail}` : ""
  }`;
  console.error(line);
}
