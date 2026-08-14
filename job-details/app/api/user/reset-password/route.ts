import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyResetToken, hashPassword } from "@/lib/user-auth";
import { logUserAction, getUserForLog } from "@/lib/action-log";

export const runtime = "nodejs";

/**
 * POST /api/user/reset-password
 * Body: { token, password }
 * Verifies the one-time reset token, then sets the new password.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      token?: string;
      password?: string;
    };
    const token = (body.token || "").trim();
    const password = body.password || "";

    if (!token) {
      return NextResponse.json({ error: "Reset token is required." }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    const userId = verifyResetToken(token);
    if (!userId) {
      return NextResponse.json(
        { error: "This reset link is invalid or has expired. Please request a new one." },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashPassword(password) },
      select: { id: true, email: true, name: true },
    });

    const logUser = await getUserForLog(userId);
    logUserAction(logUser, "password.reset", `password reset for ${user.email}`);

    return NextResponse.json({ message: "Password updated. You can now sign in." });
  } catch (e) {
    console.error("[reset-password]", e);
    return NextResponse.json({ error: "Failed to reset password." }, { status: 500 });
  }
}
