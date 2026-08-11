import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/user-auth";
import { buildUserContext } from "@/lib/chat-data";

export const runtime = "nodejs";

/**
 * GET /api/chat/context
 * Returns a compact snapshot of the user's own job data (counts, top
 * matches, companies, locations). The client fetches this ONCE when the
 * chat activates and sends it back with each message, so the LLM answers
 * quickly without a per-message DB hit.
 */
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Login required." }, { status: 401 });
    }
    const context = await buildUserContext(user.id);
    return NextResponse.json({ context });
  } catch (e) {
    console.error("[chat/context]", e);
    return NextResponse.json({ error: "Failed to load context." }, { status: 500 });
  }
}
