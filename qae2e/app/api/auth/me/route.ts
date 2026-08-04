import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { listWorkspaces } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ user: null }, { status: 200 });

  const workspaces = await listWorkspaces(user.id);
  return NextResponse.json({ user, workspaces });
}
