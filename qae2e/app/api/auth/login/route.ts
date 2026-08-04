import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionCookie } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  const user = await getUserByEmail(email);
  // Read both the PG column name (password_hash) and the file-fallback key
  // (passwordHash) so login works regardless of the active store.
  const hash = String(user?.password_hash || user?.passwordHash || "");
  if (!user || !verifyPassword(password, hash)) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  await createSessionCookie(String(user.id));
  return NextResponse.json({
    ok: true,
    user: { id: String(user.id), email: String(user.email), name: user.name ? String(user.name) : undefined },
  });
}
