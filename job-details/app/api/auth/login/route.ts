import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { checkAdminCredentials, signAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";

/**
 * POST /api/auth/login
 * Body: { username, password }
 * On success, sets an httpOnly admin session cookie (7 days).
 */
export async function POST(req: Request) {
  try {
    const { username, password } = (await req.json()) as {
      username?: string;
      password?: string;
    };

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required." },
        { status: 400 }
      );
    }

    if (!checkAdminCredentials(username.trim(), password)) {
      return NextResponse.json(
        {
          error:
            "Invalid credentials. You don't have admin access — browse the existing jobs instead.",
        },
        { status: 401 }
      );
    }

    const token = signAdminToken(username.trim());
    const store = await cookies();
    store.set(ADMIN_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

    return NextResponse.json({ ok: true, username: username.trim() });
  } catch {
    return NextResponse.json({ error: "Login failed." }, { status: 500 });
  }
}
