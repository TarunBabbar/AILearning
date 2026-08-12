import { createHmac, timingSafeEqual, randomBytes, scryptSync } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

export const USER_COOKIE = "jobdetails_user";
const SESSION_DAYS = 14;

function sessionSecret(): string {
  // No hardcoded fallback — if this is empty, session signing is disabled
  // so tokens can never be forged with a known default.
  return (
    process.env.USER_SESSION_SECRET ||
    process.env.ADMIN_PASSWORD ||
    process.env.OPENROUTER_API_KEY ||
    ""
  );
}

function hmac(value: string): string {
  return createHmac("sha256", sessionSecret()).update(value).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Hash a password with scrypt (no extra native deps). */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const next = scryptSync(password, salt, 64).toString("hex");
  return safeEqual(hash, next);
}

export function signUserToken(userId: string): string {
  const payload = `${userId}:${Date.now()}`;
  return `${Buffer.from(payload).toString("base64url")}.${hmac(payload)}`;
}

/** Returns userId if token is valid, else null. */
export function verifyUserToken(token: string | undefined): string | null {
  if (!token) return null;
  if (!sessionSecret()) return null; // signing disabled — no valid sessions
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const payload = Buffer.from(parts[0], "base64url").toString("utf8");
  if (!safeEqual(parts[1], hmac(payload))) return null;
  const colon = payload.lastIndexOf(":");
  if (colon === -1) return null;
  const userId = payload.slice(0, colon);
  const ts = Number(payload.slice(colon + 1));
  if (!userId || !Number.isFinite(ts)) return null;
  if (Date.now() - ts > SESSION_DAYS * 24 * 60 * 60 * 1000) return null;
  return userId;
}

export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  return verifyUserToken(store.get(USER_COOKIE)?.value);
}

export async function requireUserId(): Promise<string | null> {
  return getSessionUserId();
}

export function userCookieOptions(token: string) {
  return {
    name: USER_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  };
}

export async function getSessionUser() {
  const userId = await getSessionUserId();
  if (!userId) return null;
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      resume: { select: { filename: true, updatedAt: true, mimeType: true } },
    },
  });
}
