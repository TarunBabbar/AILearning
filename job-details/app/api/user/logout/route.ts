import { NextResponse } from "next/server";
import { USER_COOKIE } from "@/lib/user-auth";

export const runtime = "nodejs";

/** POST /api/user/logout */
export async function POST() {
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
