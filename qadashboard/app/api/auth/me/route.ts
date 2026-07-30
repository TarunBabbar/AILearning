import { NextRequest } from "next/server";
import { verifyToken, findUserById } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return Response.json({ user: null }, { status: 200 });
  }

  const token = auth.slice(7);
  const session = verifyToken(token);
  if (!session) {
    return Response.json({ user: null }, { status: 200 });
  }

  const user = findUserById(session.userId);
  return Response.json({ user });
}
