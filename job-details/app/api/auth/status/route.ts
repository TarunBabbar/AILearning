import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";

/**
 * GET /api/auth/status — whether the current browser has admin access.
 */
export async function GET() {
  const admin = await isAdminRequest();
  return NextResponse.json({ admin });
}
