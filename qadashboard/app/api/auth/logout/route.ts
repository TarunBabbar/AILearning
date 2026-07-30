import { cookies } from "next/headers";

export async function POST() {
  return Response.json({ success: true });
}
