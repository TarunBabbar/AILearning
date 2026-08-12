import { NextResponse } from "next/server";
import { USER_COOKIE, getSessionUser } from "@/lib/user-auth";
import { logUserAction } from "@/lib/action-log";

export const runtime = "nodejs";

/** POST /api/user/logout */
export async function POST() {
  const user = await getSessionUser();
  logUserAction(
    user ? { id: user.id, email: user.email, name: user.name } : null,
    "logout"
  );

  const res = NextResponse.json({ message: "Logged out." });
  res.cookies.set({
    name: USER_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
