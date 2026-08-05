import { NextRequest } from "next/server";
import { listRuns, getRun } from "@/lib/runs/store";
import { buildRunZip } from "@/lib/runs/bundle";
import { getSessionUser } from "@/lib/auth/session";
import { listWorkspaces } from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET /api/runs
 * Returns runs scoped to the AUTHENTICATED USER's workspaces only (personal
 * workspaces, so this is user-scoped history — never other users' runs).
 *
 *   ?workspaceId=...   (optional) restrict to one workspace
 *   ?id=...            one run's full record (must belong to the user)
 *   ?id=...&download=1 ZIP bundle
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const id = sp.get("id");
  const workspaceId = sp.get("workspaceId") || undefined;

  // The user's own workspace ids — the only ones they can see.
  const owned = (await listWorkspaces(user.id)).map((w) => w.id);

  if (id) {
    const run = await getRun(id, workspaceId);
    if (!run) return Response.json({ ok: false, error: "Run not found" }, { status: 404 });
    // Ownership: the run must belong to one of the user's workspaces.
    const runWs = String((run as unknown as { workspaceId?: string }).workspaceId || "");
    if (!owned.includes(runWs)) {
      return Response.json({ ok: false, error: "Run not found" }, { status: 404 });
    }
    if (sp.get("download")) {
      const zip = await buildRunZip(run);
      const safe = (run.title || "run").replace(/[^a-z0-9-_]/gi, "_").toLowerCase();
      return new Response(new Blob([zip]), {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="qae2e-${safe}-${run.id.slice(0, 8)}.zip"`,
        },
      });
    }
    return Response.json({ ok: true, run });
  }

  const limit = Math.min(Number(sp.get("limit") || 50), 200);
  // User-scoped: only runs in the user's own workspaces.
  const runs = await listRuns(limit, workspaceId ? [workspaceId] : owned);
  return Response.json({ ok: true, runs });
}
