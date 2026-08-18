import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js 16 proxy (formerly middleware) — auth guard at the network boundary.
 * Checks the next-auth session cookie presence; the real session is validated
 * server-side by getServerSession on each page.
 */
export function proxy(request: NextRequest) {
  const token = request.cookies.get("next-auth.session-token");
  const isWorkspace = request.nextUrl.pathname.startsWith("/workspace");
  const isLogin = request.nextUrl.pathname.startsWith("/login");

  if (isWorkspace && !token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (isLogin && token) {
    return NextResponse.redirect(new URL("/workspace", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/workspace/:path*", "/login"],
};
