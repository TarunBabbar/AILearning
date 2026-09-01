// Session management: random httpOnly cookie token backed by the sessions table
// (lib/db.ts). 30-day expiry.

import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { createSession, deleteSession, getSession, getUserById } from "../db";

const COOKIE = "qae2e_session";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface SessionUser {
  id: string;
  email: string;
  name?: string;
}

export async function createSessionCookie(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TTL_MS).toISOString();
  await createSession({ id: token, userId, expiresAt });

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
}

/**
 * Current session user, memoized per render via React.cache — so multiple
 * server components on one page (Header, Hero, CtaPanel) share a single DB
 * read instead of each calling getSession + getUserById.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  const session = await getSession(token);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) return null;
  const user = await getUserById(session.userId);
  if (!user) return null;
  return {
    id: String(user.id),
    email: String(user.email),
    name: user.name ? String(user.name) : undefined,
  };
});

export async function destroySessionCookie(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await deleteSession(token);
  store.set(COOKIE, "", { httpOnly: true, path: "/", expires: new Date(0) });
}

export { COOKIE };
