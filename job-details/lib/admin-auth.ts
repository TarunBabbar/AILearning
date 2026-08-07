import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "jobdetails_admin";

function hmac(value: string): string {
  const secret =
    process.env.ADMIN_PASSWORD ||
    process.env.OPENROUTER_API_KEY ||
    "jobdetails-secret";
  return createHmac("sha256", secret).update(value).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Verify a username/password against the env-configured admin credentials.
 */
export function checkAdminCredentials(username: string, password: string): boolean {
  const expectedUser = process.env.ADMIN_USERNAME || "admin";
  const expectedPass = process.env.ADMIN_PASSWORD || "";
  if (!expectedPass) return false;
  return safeEqual(username, expectedUser) && safeEqual(password, expectedPass);
}

/**
 * Sign a session token for the given username.
 */
export function signAdminToken(username: string): string {
  const payload = `${username}:${Date.now()}`;
  return `${Buffer.from(payload).toString("base64url")}.${hmac(payload)}`;
}

/**
 * Verify an admin session cookie value. Returns true if valid.
 */
export function verifyAdminToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const payload = Buffer.from(parts[0], "base64url").toString("utf8");
  const expected = hmac(payload);
  if (!safeEqual(parts[1], expected)) return false;
  // Expire sessions after 7 days
  const colon = payload.lastIndexOf(":");
  if (colon === -1) return false;
  const ts = Number(payload.slice(colon + 1));
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < 7 * 24 * 60 * 60 * 1000;
}

/**
 * Server-side check for the request's admin cookie.
 */
export async function isAdminRequest(): Promise<boolean> {
  const store = await cookies();
  return verifyAdminToken(store.get(ADMIN_COOKIE)?.value);
}
