import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./prisma";
import { getConfig } from "./config";

// ── Password hashing (scrypt) ──
// Format: scrypt$N$r$p$salt$hash
const KEY_LEN = 64;

export function hashPassword(password: string): string {
  const cfg = getConfig();
  if (!cfg.scryptN || !cfg.scryptR || !cfg.scryptP) {
    throw new Error("SCRYPT_N / SCRYPT_R / SCRYPT_P not set");
  }
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LEN, {
    N: cfg.scryptN,
    r: cfg.scryptR,
    p: cfg.scryptP,
  }).toString("hex");
  return `scrypt$${cfg.scryptN}$${cfg.scryptR}$${cfg.scryptP}$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, salt, hash] = parts;
  const computed = scryptSync(password, salt, KEY_LEN, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  const expected = Buffer.from(hash, "hex");
  return computed.length === expected.length && timingSafeEqual(computed, expected);
}

// ── JWT sessions (jose) ──
export function getCookieName(): string {
  return getConfig().authCookieName;
}

export function getSessionDays(): number {
  return getConfig().authSessionDays;
}

function getSecretKey(): Uint8Array {
  const cfg = getConfig();
  if (!cfg.authSecret) {
    throw new Error("AUTH_SECRET not set");
  }
  return new TextEncoder().encode(cfg.authSecret);
}

export async function createSessionToken(userId: string): Promise<string> {
  const days = getSessionDays();
  if (!days) throw new Error("AUTH_SESSION_DAYS not set");
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${days}d`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return { userId: String(payload.userId) };
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  const cfg = getConfig();
  const maxAge = cfg.authSessionDays * 24 * 60 * 60;
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: cfg.isProduction,
    path: "/",
    maxAge,
  };
}

export function buildSessionCookie(token: string): string {
  const name = getCookieName();
  const { httpOnly, sameSite, secure, path, maxAge } = sessionCookieOptions();
  const parts = ["HttpOnly", `SameSite=${sameSite}`, `Path=${path}`, `Max-Age=${maxAge}`];
  if (secure) parts.push("Secure");
  return `${name}=${token}; ${parts.join("; ")}`;
}

export function clearSessionCookie(): string {
  const name = getCookieName();
  const { sameSite, secure, path } = sessionCookieOptions();
  const parts = ["HttpOnly", `SameSite=${sameSite}`, `Path=${path}`, "Max-Age=0"];
  if (secure) parts.push("Secure");
  return `${name}=; ${parts.join("; ")}`;
}

// ── User CRUD ──
export type PublicUser = { id: string; username: string; email: string | null };

function toPublicUser(u: {
  id: string;
  username: string;
  email: string | null;
}): PublicUser {
  return { id: u.id, username: u.username, email: u.email };
}

export async function registerUser({
  username,
  email,
  password,
}: {
  username: string;
  email?: string | null;
  password: string;
}): Promise<PublicUser> {
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { username },
        ...(email ? [{ email }] : []),
      ],
    },
  });
  if (existing) {
    throw new Error(
      existing.username === username ? "Username already taken" : "Email already registered"
    );
  }
  const user = await prisma.user.create({
    data: { username, email: email || null, passwordHash: hashPassword(password) },
  });
  return toPublicUser(user);
}

export async function authenticateUser(
  username: string,
  password: string
): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new Error("Invalid username or password");
  }
  return toPublicUser(user);
}

export async function findUserById(id: string): Promise<PublicUser | null> {
  const user = await prisma.user.findUnique({ where: { id } });
  return user ? toPublicUser(user) : null;
}

export async function findUserByUsername(username: string): Promise<PublicUser | null> {
  const user = await prisma.user.findUnique({ where: { username } });
  return user ? toPublicUser(user) : null;
}
