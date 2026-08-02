// POST /api/run — trigger a local Docker test run and stream NDJSON events
// (status / log / result / done / error) back to the workspace.

import { NextRequest } from "next/server";
import { runTests } from "@/lib/exec";

export const runtime = "nodejs";
export const maxDuration = 600;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const requirementId = String(body.requirementId || "");
  const cycleId = String(body.cycleId || "");
  const repoDir = String(body.repoDir || "");
  const repoUrl = String(body.repoUrl || "");
  const command = String(body.command || "");
  const jiraProjectKey = String(body.jiraProjectKey || "");
  const testrailRunId = body.testrailRunId ? Number(body.testrailRunId) : undefined;
  if (!requirementId) return Response.json({ error: "requirementId required" }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        } catch {
          // client disconnected
        }
      };

      send({ type: "status", message: "Checking Docker…" });
      const result = await runTests({
        requirementId,
        cycleId: cycleId || undefined,
        repoDir: repoDir || undefined,
        repoUrl: repoUrl || undefined,
        command: command || undefined,
        jiraProjectKey: jiraProjectKey || undefined,
        testrailRunId,
      });

      if (!result.ok && /Docker is not running/.test(result.stderr)) {
        send({ type: "error", message: result.stderr });
        controller.close();
        return;
      }

      if (result.stdout) send({ type: "log", text: result.stdout.slice(-8000) });
      if (result.stderr) send({ type: "log", text: result.stderr.slice(-4000) });
      send({ type: "result", summary: result.summary, exitCode: result.exitCode });
      send({ type: "done" });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
