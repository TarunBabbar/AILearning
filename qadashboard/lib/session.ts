import { NextRequest } from "next/server";
import { verifySessionToken } from "./auth";
import { getConfig } from "./config";

// Reads the session cookie and returns the userId, or null when unauthenticated.
export async function getSessionUserId(req: NextRequest): Promise<string | null> {
  const cfg = getConfig();
  const cookieName = cfg.authCookieName;
  const token = cookieName ? req.cookies.get(cookieName)?.value : undefined;
  if (!token) return null;
  const session = await verifySessionToken(token);
  return session?.userId ?? null;
}

export function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
