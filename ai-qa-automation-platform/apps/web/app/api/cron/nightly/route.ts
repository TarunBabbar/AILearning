import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createRun, executeRun } from "@/lib/exec/orchestrator";

/**
 * Nightly regression cron (Vercel). Runs the full approved suite for every
 * workspace that has approved test cases. Guarded by a CRON_SECRET header.
 */
export async function GET(req: Request) {
  const secret = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const workspaces = await prisma.workspace.findMany({
    where: { testCases: { some: { status: "approved" } } },
    select: { id: true },
  });

  const results = [];
  for (const ws of workspaces) {
    try {
      const run = await createRun(ws.id, "nightly");
      const summary = await executeRun(run.id);
      results.push({ workspaceId: ws.id, run_id: run.id, ...summary });
    } catch (e) {
      results.push({ workspaceId: ws.id, error: (e as Error).message });
    }
  }

  return NextResponse.json({ runs: results });
}
