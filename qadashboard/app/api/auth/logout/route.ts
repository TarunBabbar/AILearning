import { clearSessionCookie } from "@/lib/auth";

export async function POST() {
  const response = Response.json({ success: true });
  response.headers.set("Set-Cookie", clearSessionCookie());
  return response;
}
