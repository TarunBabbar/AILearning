import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  signUserToken,
  userCookieOptions,
  verifyPassword,
} from "@/lib/user-auth";
import { logUserAction, logUserActionError } from "@/lib/action-log";

export const runtime = "nodejs";

/**
 * POST /api/user/login
 * Body: { email, password }
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string; password?: string };
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      logUserActionError(null, "login", `failed login attempt for ${email}`);
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    logUserAction(
      { id: user.id, email: user.email, name: user.name },
      "login",
      "success"
    );

    const token = signUserToken(user.id);
    const res = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name },
      message: "Logged in.",
    });
    res.cookies.set(userCookieOptions(token));
    return res;
  } catch (e) {
    console.error("[user/login]", e);
    return NextResponse.json({ error: "Login failed." }, { status: 500 });
  }
}
