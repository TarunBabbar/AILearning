import { NextRequest } from "next/server";
import { runAgent } from "@/lib/agents/runner";
import { getAgent } from "@/lib/agents/registry";
import { maybePersistArtifact } from "@/lib/agents/persist";
import { insertOne, listAll, withWorkspace } from "@/lib/store";
import type { AgentId, Requirement } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST /api/agents/[agentId]
 * Runs one agent and streams NDJSON events: status / tool_call / tool_result /
 * artifact / chunk / done / error. Scoped to a workspace via body.workspaceId.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await ctx.params;
  const agent = getAgent(agentId as AgentId);
  if (!agent) return Response.json({ error: "Unknown agent" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const prompt = String(body.prompt || body.userPrompt || "");
  const requirementId = String(body.requirementId || "");
  const workspaceId = String(body.workspaceId || "");

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

      await withWorkspace(workspaceId, async () => {
        // Persist the traceability root up front so the agent's tools can
        // actually load it (requirement_analyze / requirement_save / etc.).
        if (requirementId && body.title != null && body.content != null) {
          const existing = (await listAll<Requirement>("requirements")).find((r) => r.id === requirementId);
          if (!existing) {
            const req: Requirement = {
              id: requirementId,
              title: String(body.title),
              source: String(body.source || "manual") as Requirement["source"],
              sourceKey: body.sourceKey ? String(body.sourceKey) : undefined,
              content: String(body.content),
              createdAt: new Date().toISOString(),
            };
            await insertOne("requirements", req);
            send({ type: "artifact", agentId, artifact: "requirement", id: requirementId });
          }
        }

        await runAgent(
          {
            agentId: agentId as AgentId,
            userPrompt: prompt,
            requirementId: requirementId || undefined,
            signal: req.signal,
          },
          async (e) => {
            // Persist structured artifacts as they're produced.
            if (e.type === "chunk") {
              const artifact = await maybePersistArtifact(agentId as AgentId, e.text, requirementId || undefined);
              if (artifact) send({ type: "artifact", agentId, artifact: artifact.type, id: artifact.id });
            }
            send(e);
          }
        );

        send({ type: "done", agentId, artifact: "analysis", id: "" });
      });

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
