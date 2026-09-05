import { NextRequest } from "next/server";
import { orchestrate } from "@/lib/agents/orchestrator";
import { getAgent } from "@/lib/agents/registry";
import { maybePersistArtifact } from "@/lib/agents/persist";
import type { AgentEvent, AgentId } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST /api/pipeline
 * One-click: runs the full 6-agent chain (RI → MT → AS → EX → DO → IQ) on a
 * single traceability root and streams NDJSON events. Emits `agent_start` /
 * `agent_done` so the UI shows which agent is running.
 *
 * Body:
 *   { requirementId, title?, source?, sourceKey?, content?,
 *     startFrom?: number,        // resume: skip agents before this index
 *     env?: Record<string,string> }  // intake values applied for this run
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const requirementId = String(body.requirementId || "");
  if (!requirementId) {
    return Response.json({ error: "requirementId required" }, { status: 400 });
  }

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

      let failed = false;

      const emit = async (e: AgentEvent) => {
        if (e.type === "status" && e.message.includes("finished")) {
          const agent = getAgent(e.agentId as AgentId);
          if (agent) {
            send({ type: "step", agentId: e.agentId, step: agent.step, done: true });
          }
        }
        // Persist structured artifacts produced by any agent in the chain
        // (analysis / coverage / script / release). This is what makes the
        // traceability rail and summary populate.
        if (e.type === "chunk") {
          const artifact = await maybePersistArtifact(e.agentId as AgentId, e.text, requirementId);
          if (artifact) send({ type: "artifact", agentId: e.agentId, artifact: artifact.type, id: artifact.id });
        }
        // Attach agent metadata (code/name/index) to error events so the UI can
        // offer "Retry from this agent" — the runner already enriches them.
        if (e.type === "error") {
          failed = true;
          const agent = getAgent(e.agentId as AgentId);
          if (agent) {
            send({
              ...e,
              code: agent.code,
              name: agent.name,
              index: (e as unknown as { index?: number }).index ?? 0,
            } as AgentEvent & { code: string; name: string; index: number });
          } else {
            send(e);
          }
          return;
        }
        send(e);
      };

      // Stop the run if the client aborts (Stop button) — don't waste LLM calls.
      req.signal.addEventListener("abort", () => {
        send({ type: "error", agentId: "pipeline", message: "Pipeline stopped by user." });
        try {
          controller.close();
        } catch {
          // already closed
        }
      });

      try {
        await orchestrate(
          requirementId,
          emit,
          {
            source: body.source ? String(body.source) : "manual",
            sourceKey: body.sourceKey ? String(body.sourceKey) : undefined,
            title: body.title ? String(body.title) : "Untitled requirement",
            content: body.content ? String(body.content) : "",
            startFrom: body.startFrom ? Number(body.startFrom) : undefined,
            // Resume continuity: the same runId merges the pre-pause half into
            // one history entry; testResults carries real Docker results so
            // EX/DO record actual executions instead of "not executed".
            runId: body.runId ? String(body.runId) : undefined,
            testResults: body.testResults ? String(body.testResults) : undefined,
            workspaceId: body.workspaceId ? String(body.workspaceId) : undefined,
            env: body.env && typeof body.env === "object" ? (body.env as Record<string, string>) : undefined,
            signal: req.signal,
          }
        );
      } catch (err) {
        failed = true;
        if (req.signal.aborted) {
          // client already gone — don't send anything
          return;
        }
        send({ type: "error", agentId: "pipeline", message: err instanceof Error ? err.message : String(err) });
      }

      // Only emit `done` when the pipeline actually completed — an error or
      // abort is already surfaced via the error event above.
      if (!failed && !req.signal.aborted) {
        send({ type: "done", agentId: "pipeline", artifact: "release", id: requirementId });
      }
      try {
        controller.close();
      } catch {
        // already closed
      }
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

