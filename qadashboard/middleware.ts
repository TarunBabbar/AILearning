import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getConfig } from "@/lib/config";

const AUTH_PATHS = new Set([
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/logout",
  "/api/auth/me",
]);

function getSecretKey(): Uint8Array {
  const cfg = getConfig();
  if (!cfg.authSecret) {
    throw new Error("AUTH_SECRET not set");
  }
  return new TextEncoder().encode(cfg.authSecret);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only protect API routes; allow public page routes (pages handle their own redirect)
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Allow auth endpoints through
  if (AUTH_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  // Everything else requires a valid session cookie
  const cfg = getConfig();
  const cookieName = cfg.authCookieName;
  const token = cookieName ? req.cookies.get(cookieName)?.value : undefined;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await jwtVerify(token, getSecretKey());
    return NextResponse.next();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export const config = {
  matcher: ["/api/:path*"],
};
