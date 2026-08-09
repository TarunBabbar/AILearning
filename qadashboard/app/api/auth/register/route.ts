import { NextRequest } from "next/server";
import { registerUser, createSessionToken, buildSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { username, email, password } = await req.json();
    if (!username || !password) {
      return Response.json({ error: "Username and password required" }, { status: 400 });
    }
    if (typeof username !== "string" || username.trim().length < 3) {
      return Response.json({ error: "Username must be at least 3 characters" }, { status: 400 });
    }
    if (typeof password !== "string" || password.length < 6) {
      return Response.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const user = await registerUser({ username: username.trim(), email: email || null, password });
    const token = await createSessionToken(user.id);
    const response = Response.json({ user, token }, { status: 201 });
    response.headers.set("Set-Cookie", buildSessionCookie(token));
    return response;
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Registration failed" },
      { status: 400 }
    );
  }
}
