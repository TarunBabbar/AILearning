import { NextRequest } from "next/server";
import { verifySessionToken, findUserById } from "@/lib/auth";
import { getConfig } from "@/lib/config";

export async function GET(req: NextRequest) {
  const cfg = getConfig();
  const cookieName = cfg.authCookieName;
  const token = cookieName ? req.cookies.get(cookieName)?.value : undefined;

  if (!token) {
    return Response.json({ user: null }, { status: 200 });
  }

  const session = await verifySessionToken(token);
  if (!session) {
    return Response.json({ user: null }, { status: 200 });
  }

  const user = await findUserById(session.userId);
  return Response.json({ user });
}
