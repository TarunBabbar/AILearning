import { NextRequest } from "next/server";
import { authenticateUser, createSessionToken, buildSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return Response.json({ error: "Username and password required" }, { status: 400 });
    }

    const user = await authenticateUser(username, password);
    const token = await createSessionToken(user.id);
    const response = Response.json({ user, token });
    response.headers.set("Set-Cookie", buildSessionCookie(token));
    return response;
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Invalid credentials" },
      { status: 401 }
    );
  }
}
