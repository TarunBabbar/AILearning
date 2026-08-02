// Agent runner: drives one agent through an OpenRouter tool-calling loop,
// emitting NDJSON events so the UI can stream progress live.

import { chatCompletion, extractContent, extractToolCalls, LlmError, type ChatMessage } from "../llm/openrouter";
import { getAgent } from "./registry";
import { getTool } from "./tools";
import type { AgentEvent, AgentId, ToolInput } from "../types";

export interface RunOptions {
  agentId: AgentId;
  userPrompt: string;
  requirementId?: string;
  maxSteps?: number;
  lifecycle?: { index: number; total: number };
  signal?: AbortSignal;
}

/**
 * Runs the agent loop. Events are pushed to `emit` as they happen and also
 * accumulated and returned (for non-streaming consumers like the MCP server).
 */
export async function runAgent(opts: RunOptions, emit: (e: AgentEvent) => void): Promise<AgentEvent[]> {
  const agent = getAgent(opts.agentId);
  if (!agent) throw new Error(`Unknown agent: ${opts.agentId}`);

  const events: AgentEvent[] = [];
  const push = (e: AgentEvent) => {
    const stamped = { ...e, ts: Date.now() } as AgentEvent;
    events.push(stamped);
    emit(stamped);
  };

  const tools = agent.tools
    .map((name) => getTool(name))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  // Give the agent its traceability root so every tool call links to it.
  const requirementHint = opts.requirementId
    ? `\nThe requirementId is "${opts.requirementId}". Use this exact id when calling requirement_save / requirement_analyze / coverage_get / coverage_save / script_save / cycle_create / defect_create / release_confidence, and reference it in any JSON you return.`
    : "";
  const messages: ChatMessage[] = [
    { role: "system", content: agent.systemPrompt },
    { role: "user", content: opts.userPrompt + requirementHint },
  ];

  const isAS = agent.id === "automation-script";
  const maxSteps = opts.maxSteps ?? (isAS ? 16 : 10);
  let steps = 0;
  let scriptSaved = false;
  let coverageFetched = false;
  let asNudges = 0;
  const lc = opts.lifecycle || { index: 0, total: 1 };

  push({ type: "status", agentId: agent.id, message: `${agent.name} started` });
  push({ type: "agent_start", agentId: agent.id, code: agent.code, name: agent.name, index: lc.index, total: lc.total });

  try {
    while (steps < maxSteps) {
      if (opts.signal?.aborted) break;
      steps++;

      // AS: force tool use until script_save succeeds (free models often stop at prose).
      let toolChoice: "auto" | "required" | { type: "function"; function: { name: string } } = "auto";
      if (isAS && !scriptSaved) {
        if (coverageFetched) {
          toolChoice = { type: "function", function: { name: "script_save" } };
        } else {
          toolChoice = "required";
        }
      }

      const res = await chatCompletion(messages, {
        model: agent.model,
        temperature: 0.2,
        maxTokens: 8192,
        tools: tools.map((t) => ({
          type: "function" as const,
          function: {
            name: t.name,
            description: t.description,
            parameters: t.inputSchema as Record<string, unknown>,
          },
        })),
        toolChoice,
      });

      const message = res.choices[0]?.message;
      const toolCalls = extractToolCalls(message && message.role === "assistant" ? message : undefined);

      if (!toolCalls.length) {
        const content = extractContent(message);
        if (content) push({ type: "chunk", agentId: agent.id, text: content });

        // AS often announces "I'll generate…" then stops without script_save — nudge and continue.
        if (isAS && !scriptSaved && asNudges < 2 && steps < maxSteps) {
          asNudges++;
          push({
            type: "status",
            agentId: agent.id,
            message: `AS returned prose without script_save — nudge ${asNudges}/2`,
          });
          messages.push({
            role: "user",
            content:
              "STOP. Do not write more prose. Call script_save NOW with framework=\"playwright\", language=\"typescript\", coverageId from coverage_get, and files[{path, code}] containing complete .spec.ts source for the test cases. Empty reply without the tool call is a failure.",
          });
          continue;
        }
        break;
      }

      messages.push(message);

      for (const call of toolCalls) {
        const tool = getTool(call.function.name);
        push({ type: "tool_call", agentId: agent.id, tool: call.function.name, args: safeParse(call.function.arguments) });

        if (!tool) {
          const errText = `Unknown tool ${call.function.name}`;
          messages.push({ role: "tool", tool_call_id: call.id, content: errText });
          push({ type: "tool_result", agentId: agent.id, tool: call.function.name, summary: errText });
          continue;
        }

        try {
          const result = await tool.handler(safeParse(call.function.arguments));
          const text = result.content.map((c) => c.text).join("\n");
          messages.push({ role: "tool", tool_call_id: call.id, content: text });
          push({
            type: "tool_result",
            agentId: agent.id,
            tool: tool.name,
            summary: summarize(text),
            text,
          });
          if (tool.name === "coverage_get" && !text.startsWith("ERROR")) {
            coverageFetched = true;
          }
          if (tool.name === "script_save" && text.startsWith("Script saved")) {
            scriptSaved = true;
            const id = text.match(/id=([^\s]+)/)?.[1];
            if (id) push({ type: "artifact", agentId: agent.id, artifact: "script", id });
          } else if (tool.name === "coverage_save" && text.startsWith("Coverage saved")) {
            const id = text.match(/id=([^\s]+)/)?.[1];
            if (id) push({ type: "artifact", agentId: agent.id, artifact: "coverage", id });
          }
        } catch (err) {
          const errText = `Tool ${tool.name} failed: ${err instanceof Error ? err.message : String(err)}`;
          messages.push({ role: "tool", tool_call_id: call.id, content: errText });
          push({ type: "tool_result", agentId: agent.id, tool: call.function.name, summary: errText });
        }
      }

      if (isAS && scriptSaved) break;
    }

    push({ type: "status", agentId: agent.id, message: `${agent.name} finished` });
    push({ type: "agent_done", agentId: agent.id, code: agent.code, name: agent.name, index: lc.index, total: lc.total });
  } catch (err) {
    const msg =
      err instanceof LlmError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    push({ type: "error", agentId: agent.id, message: msg });
  }

  return events;
}

function safeParse(raw: string): ToolInput {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function summarize(text: string): string {
  const first = text.split("\n")[0] || text;
  return first.length > 120 ? first.slice(0, 117) + "…" : first;
}
