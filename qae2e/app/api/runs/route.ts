import { NextRequest } from "next/server";
import { listRuns, getRun } from "@/lib/runs/store";
import { buildRunZip } from "@/lib/runs/bundle";

export const runtime = "nodejs";

// GET /api/runs?workspaceId=...        → list saved runs for a workspace (newest first)
// GET /api/runs?id=...&workspaceId=...  → one run's full record
// GET /api/runs?id=...&workspaceId=...&download=1 → ZIP bundle (code + logs + results)
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const id = sp.get("id");
  const workspaceId = sp.get("workspaceId") || undefined;

  if (id) {
    const run = await getRun(id, workspaceId);
    if (!run) return Response.json({ ok: false, error: "Run not found" }, { status: 404 });
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
  const runs = await listRuns(limit, workspaceId);
  return Response.json({ ok: true, runs });
}
