import { NextRequest } from "next/server";
import { authenticateUser, createToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return Response.json({ error: "Username and password required" }, { status: 400 });
    }

    const user = authenticateUser(username, password);
    const token = createToken(user.id);

    return Response.json({ user, token });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Invalid credentials" },
      { status: 401 }
    );
  }
}
