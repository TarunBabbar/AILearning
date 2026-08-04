import { NextRequest, NextResponse } from "next/server";
import { createUser } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { createSessionCookie } from "@/lib/auth/session";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");
  const name = String(body?.name || "").trim();

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const res = await createUser({
    id: crypto.randomUUID(),
    email,
    passwordHash: hashPassword(password),
    name: name || undefined,
  });
  if (res === "duplicate") {
    return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
  }
  if (res === "error") {
    return NextResponse.json({ error: "Could not create account" }, { status: 500 });
  }

  const user = await createUserLookup(email);
  if (!user) return NextResponse.json({ error: "Could not create account" }, { status: 500 });

  await createSessionCookie(user.id);

  return NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, name: user.name },
  });
}

async function createUserLookup(email: string) {
  const { getUserByEmail } = await import("@/lib/db");
  const u = await getUserByEmail(email);
  if (!u) return null;
  return { id: String(u.id), email: String(u.email), name: u.name ? String(u.name) : undefined };
}
