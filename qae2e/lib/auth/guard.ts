// Auth guards for API routes. Returns a typed user or a 401 JSON response.

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, type SessionUser } from "./session";

export async function requireUser(
  req: NextRequest
): Promise<{ user: SessionUser } | { user: null; response: NextResponse }> {
  const user = await getSessionUser();
  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }
  return { user };
}
