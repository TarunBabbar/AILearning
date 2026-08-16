// POST /api/run — trigger a local Docker test run and stream NDJSON events
// (status / log / result / done / error) back to the workspace.

import { NextRequest } from "next/server";
import { runTests } from "@/lib/exec";
import { materializeScripts } from "@/lib/exec/autofix";
import { isRunnableAutomation } from "@/lib/exec/script-quality";
import { listAll, withWorkspace } from "@/lib/store";
import type { Script } from "@/lib/types";

export const runtime = "nodejs";
// Hobby plan caps serverless functions at 300s (5 min).
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const requirementId = String(body.requirementId || "");
  const cycleId = String(body.cycleId || "");
  const repoDirIn = String(body.repoDir || "");
  const repoUrl = String(body.repoUrl || "");
  const command = String(body.command || "");
  const workspaceId = String(body.workspaceId || "");
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

      try {
        send({ type: "status", message: "Checking Docker, image, node/npm, and Playwright Chromium…" });

        let repoDir = repoDirIn || undefined;
        // No external repo? Materialize the latest saved automation for this requirement.
        if (!repoDir && !repoUrl) {
          const script = await withWorkspace(workspaceId, () =>
            listAll<Script>("scripts").then((s) => s.filter((x) => x.requirementId === requirementId).pop())
          );
          if (!script) {
            send({
              type: "error",
              message: "No automation scripts saved for this requirement. Re-run the pipeline through Agent 3 (AS).",
            });
            send({ type: "done" });
            controller.close();
            return;
          }
          const quality = isRunnableAutomation(script.files);
          if (!quality.ok) {
            send({
              type: "error",
              message: `Saved scripts are not runnable: ${quality.reason}. Files: ${script.files.map((f) => f.path).join(", ")}. Re-run AS or wait for POM fallback.`,
            });
            send({ type: "done" });
            controller.close();
            return;
          }
          const mat = materializeScripts(script);
          repoDir = mat.repoDir;
          send({ type: "status", message: `Materialized ${mat.files.length} file(s) → ${repoDir}` });
        }

        const result = await withWorkspace(workspaceId, () =>
          runTests({
            requirementId,
            cycleId: cycleId || undefined,
            repoDir,
            repoUrl: repoUrl || undefined,
            command: command || undefined,
          })
        );

        if (!result.ok && /Docker is not running/.test(result.stderr)) {
          send({
            type: "error",
            message:
              "Docker is not running. Start Docker Desktop (or the Docker engine on your machine), wait for the whale icon to show it is ready, then retry.",
          });
          send({ type: "done" });
          controller.close();
          return;
        }
        if (!result.ok && /could not be pulled/.test(result.stderr)) {
          send({ type: "error", message: result.stderr });
          send({ type: "done" });
          controller.close();
          return;
        }
        if (!result.ok && /Container preflight failed/.test(result.stderr)) {
          send({ type: "error", message: result.stderr });
          send({ type: "done" });
          controller.close();
          return;
        }

        if (result.stdout) send({ type: "log", text: result.stdout.slice(-8000) });
        if (result.stderr) send({ type: "log", text: result.stderr.slice(-4000) });
        send({ type: "result", summary: result.summary, exitCode: result.exitCode });
        send({ type: "done" });
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : String(err) });
        send({ type: "done" });
      }
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
