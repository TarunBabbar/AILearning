import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  hashPassword,
  signUserToken,
  userCookieOptions,
} from "@/lib/user-auth";
import { logUserAction } from "@/lib/action-log";
import { rateLimited, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * POST /api/user/register
 * Body: { email, password, name }
 */
export async function POST(req: Request) {
  try {
    const ip = clientIp(req);
    if (rateLimited(`register:${ip}`, 5, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Too many accounts created from this address. Try later." },
        { status: 429 }
      );
    }

    const body = (await req.json()) as {
      email?: string;
      password?: string;
      name?: string;
    };
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";
    const name = (body.name || "").trim();

    if (!name || name.length < 2) {
      return NextResponse.json(
        { error: "Name is required (at least 2 characters)." },
        { status: 400 }
      );
    }
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hashPassword(password),
        name,
      },
      select: { id: true, email: true, name: true },
    });

    logUserAction(
      { id: user.id, email: user.email, name: user.name },
      "register",
      "new account created"
    );

    const token = signUserToken(user.id);
    const res = NextResponse.json({
      user,
      message: "Account created.",
    });
    res.cookies.set(userCookieOptions(token));
    return res;
  } catch (e) {
    console.error("[user/register]", e);
    return NextResponse.json({ error: "Registration failed." }, { status: 500 });
  }
}
