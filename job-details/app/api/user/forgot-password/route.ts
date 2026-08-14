import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signResetToken } from "@/lib/user-auth";
import { sendResetEmail } from "@/lib/email";
import { rateLimitCheck, clientIp } from "@/lib/rate-limit";
import { getConfig } from "@/lib/config";

export const runtime = "nodejs";

/**
 * POST /api/user/forgot-password
 * Body: { email }
 * Sends a one-time password-reset link to the email if an account exists.
 *
 * SECURITY: the response is identical whether or not the account exists —
 * it never reveals whether an email is registered (prevents account
 * enumeration). We also never log whether the account was found.
 */
export async function POST(req: Request) {
  try {
    const ip = clientIp(req);
    // Configurable rate limit (per IP): RATE_LIMIT_FORGOT_PASSWORD / window.
    // Default 5 per 15 min — protects against email enumeration/spam.
    const limit = Number(process.env.RATE_LIMIT_FORGOT_PASSWORD) || 5;
    const { blocked, remaining } = rateLimitCheck(
      `forgot-password:${ip}`,
      limit,
      15 * 60 * 1000
    );
    if (blocked) {
      return NextResponse.json(
        { error: "Too many requests. Please try again in a little while." },
        { status: 429 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as { email?: string };
    const email = (body.email || "").trim().toLowerCase();

    // No account outcome is ever revealed — same message for every case.
    const genericMessage = `If an account exists for ${email || "this email"}, we've sent a password reset link. It expires in 1 hour. ${remaining > 0 ? `You have ${remaining} attempt${remaining === 1 ? "" : "s"} left. ` : ""}Please also check your spam or promotions folder — the email can sometimes land there.`;

    if (!email || !email.includes("@")) {
      return NextResponse.json({ message: genericMessage });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true },
    });

    if (user) {
      const token = signResetToken(user.id);
      const appUrl = getConfig().appUrl || "https://qajobs.vercel.app";
      const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;
      // Fire-and-forget — don't block the response on SMTP. Never log whether
      // the account existed; only log genuine SMTP transport failures.
      sendResetEmail(user.email, user.name || "there", resetUrl).then((r) => {
        if (!r.ok) console.error("[forgot-password] SMTP error:", r.error);
      });
    }

    // Same response for found/not-found — no account enumeration.
    return NextResponse.json({ message: genericMessage });
  } catch (e) {
    console.error("[forgot-password]", e);
    return NextResponse.json({ error: "Failed to send reset email." }, { status: 500 });
  }
}
