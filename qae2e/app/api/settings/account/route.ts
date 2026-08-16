import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { destroySessionCookie } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { listSessionsForUser, deleteSession, getUserByEmail } from "@/lib/db";

export const runtime = "nodejs";

// GET /api/settings/account — current account info + active sessions.
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.user) return auth.response;
  const sessions = await listSessionsForUser(auth.user.id);
  return NextResponse.json({ user: auth.user, sessions });
}

// POST /api/settings/account
//   { action: "password", currentPassword, newPassword }
//   { action: "email",    email }
//   { action: "revoke-session", sessionId }
//   { action: "logout-all" }
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.user) return auth.response;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const action = String(body.action || "");

  if (action === "password") {
    const current = String(body.currentPassword || "");
    const next = String(body.newPassword || "");
    if (!current || next.length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
    }
    const user = await getUserByEmail(auth.user.email);
    if (!user || !verifyPassword(current, String(user.password_hash))) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }
    // Persist via the same storage the signup uses: update password_hash.
    // (Direct DB write via pg; file fallback rewrites the users store.)
    await updateUserPassword(auth.user.id, hashPassword(next));
    return NextResponse.json({ ok: true, message: "Password updated." });
  }

  if (action === "email") {
    const email = String(body.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    const existing = await getUserByEmail(email);
    if (existing && existing.id !== auth.user.id) {
      return NextResponse.json({ error: "That email is already in use" }, { status: 409 });
    }
    await updateUserEmail(auth.user.id, email);
    return NextResponse.json({ ok: true, message: "Email updated." });
  }

  if (action === "revoke-session") {
    const sessionId = String(body.sessionId || "");
    if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    await deleteSession(sessionId);
    return NextResponse.json({ ok: true });
  }

  if (action === "logout-all") {
    const sessions = await listSessionsForUser(auth.user.id);
    for (const s of sessions) await deleteSession(s.id);
    await destroySessionCookie();
    return NextResponse.json({ ok: true, loggedOut: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

async function updateUserPassword(userId: string, passwordHash: string): Promise<void> {
  const { sql } = await import("@vercel/postgres");
  try {
    if (process.env.POSTGRES_URL || process.env.POSTGRES_HOST || process.env.POSTGRES_DATABASE || process.env.DATABASE_URL) {
      await sql`UPDATE users SET password_hash = ${passwordHash} WHERE id = ${userId}`;
      return;
    }
  } catch {
    // fall through
  }
  // File fallback: rewrite the users store.
  const { readFileStore, writeFileStore } = await import("@/lib/db");
  const all = await readFileStore<{ id: string; password_hash: string }>("users");
  await writeFileStore(
    "users",
    all.map((u) => (u.id === userId ? { ...u, password_hash: passwordHash } : u))
  );
}

async function updateUserEmail(userId: string, email: string): Promise<void> {
  try {
    if (process.env.POSTGRES_URL || process.env.POSTGRES_HOST || process.env.POSTGRES_DATABASE || process.env.DATABASE_URL) {
      const { sql } = await import("@vercel/postgres");
      await sql`UPDATE users SET email = ${email} WHERE id = ${userId}`;
      return;
    }
  } catch {
    // fall through
  }
  const { readFileStore, writeFileStore } = await import("@/lib/db");
  const all = await readFileStore<{ id: string; email: string }>("users");
  await writeFileStore(
    "users",
    all.map((u) => (u.id === userId ? { ...u, email } : u))
  );
}
