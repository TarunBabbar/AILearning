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

      const emit = (e: AgentEvent) => {
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
          const artifact = maybePersistArtifact(e.agentId as AgentId, e.text, requirementId);
          if (artifact) send({ type: "artifact", agentId: e.agentId, artifact: artifact.type, id: artifact.id });
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
            env: body.env && typeof body.env === "object" ? (body.env as Record<string, string>) : undefined,
            signal: req.signal,
          }
        );
      } catch (err) {
        if (req.signal.aborted) {
          // client already gone — don't send anything
          return;
        }
        send({ type: "error", agentId: "pipeline", message: err instanceof Error ? err.message : String(err) });
      }

      send({ type: "done", agentId: "pipeline", artifact: "release", id: requirementId });
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

