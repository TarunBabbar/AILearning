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
    ? `\nThe requirementId is "${opts.requirementId}". Use this exact id when calling requirement_save / requirement_analyze / coverage_get / coverage_save / automation_framework_generate / script_save / cycle_create / defect_create / release_confidence, and reference it in any JSON you return.`
    : "";
  const messages: ChatMessage[] = [
    { role: "system", content: agent.systemPrompt },
    { role: "user", content: opts.userPrompt + requirementHint },
  ];

  const isAS = agent.id === "automation-script";
  const isRI = agent.id === "requirement-intelligence";
  const isMT = agent.id === "manual-test-case";
  const maxSteps = opts.maxSteps ?? (isAS ? 12 : 10);
  let steps = 0;
  let scriptSaved = false;
  let coverageFetched = false;
  let analysisSaved = false;
  let coverageSaved = false;
  let asNudges = 0;
  let riNudges = 0;
  let mtNudges = 0;
  const lc = opts.lifecycle || { index: 0, total: 1 };

  push({ type: "status", agentId: agent.id, message: `${agent.name} started` });
  push({ type: "agent_start", agentId: agent.id, code: agent.code, name: agent.name, index: lc.index, total: lc.total });

  try {
    while (steps < maxSteps) {
      if (opts.signal?.aborted) break;
      steps++;

      // AS: force tools until server-side framework generate succeeds.
      let toolChoice: "auto" | "required" | { type: "function"; function: { name: string } } = "auto";
      if (isAS && !scriptSaved) {
        if (coverageFetched) {
          toolChoice = { type: "function", function: { name: "automation_framework_generate" } };
        } else {
          toolChoice = "required";
        }
      }
      // RI: force tool use on the first turn so it analyzes the pre-saved
      // requirement instead of replying with prose.
      if (isRI && steps === 1 && !analysisSaved) {
        toolChoice = { type: "function", function: { name: "requirement_analyze" } };
      }
      // MT: force tool use on the first turn so it loads the analysis.
      if (isMT && steps === 1 && !coverageSaved) {
        toolChoice = { type: "function", function: { name: "requirement_analyze" } };
      }

      const res = await chatCompletion(messages, {
        model: agent.model,
        temperature: 0.2,
        maxTokens: isAS ? 4096 : 8192,
        tools: tools.map((t) => ({
          type: "function" as const,
          function: {
            name: t.name,
            description: t.description,
            parameters: t.inputSchema as Record<string, unknown>,
          },
        })),
        toolChoice,
        signal: opts.signal,
        // Surface model rotation in the live logs (e.g. overloaded → next free model).
        onModelSwitch: (from, to, reason) => {
          push({
            type: "status",
            agentId: agent.id,
            message: `LLM fallback: ${from} unavailable (${reason}) — switching to ${to}`,
          });
        },
      });

      const message = res.choices[0]?.message;
      const toolCalls = extractToolCalls(message && message.role === "assistant" ? message : undefined);

      // Stop as soon as the pipeline is aborted — no more LLM calls, no more
      // tool side effects, no "agent finished" after the pipeline died.
      if (opts.signal?.aborted) break;

      if (!toolCalls.length) {
        const content = extractContent(message);
        if (content) push({ type: "chunk", agentId: agent.id, text: content });

        if (isAS && !scriptSaved && asNudges < 2 && steps < maxSteps) {
          asNudges++;
          push({
            type: "status",
            agentId: agent.id,
            message: `AS returned prose without automation_framework_generate — nudge ${asNudges}/2`,
          });
          messages.push({
            role: "user",
            content:
              "STOP. Call automation_framework_generate NOW with requirementId (and coverageId from coverage_get). Do not call script_save. Do not write prose.",
          });
          continue;
        }
        if (isRI && !analysisSaved && riNudges < 2 && steps < maxSteps) {
          riNudges++;
          push({
            type: "status",
            agentId: agent.id,
            message: `RI returned prose without saving an analysis — nudge ${riNudges}/2`,
          });
          messages.push({
            role: "user",
            content:
              "STOP writing prose. The requirement is already saved. Call requirement_analyze with the requirementId, then return the full analysis JSON as your final message. Do not ask for the requirement text.",
          });
          continue;
        }
        if (isMT && !coverageSaved && mtNudges < 2 && steps < maxSteps) {
          mtNudges++;
          push({
            type: "status",
            agentId: agent.id,
            message: `MT returned prose without saving coverage — nudge ${mtNudges}/2`,
          });
          messages.push({
            role: "user",
            content:
              "STOP writing prose. Call requirement_analyze to load the analysis, then coverage_save with the test cases. Do not return prose only.",
          });
          continue;
        }
        break;
      }

      messages.push(message);

      for (const call of toolCalls) {
        // Check before EACH tool so a mid-loop abort skips remaining tools.
        if (opts.signal?.aborted) break;
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
          if (tool.name === "requirement_analyze" && !text.startsWith("ERROR")) {
            // RI uses the returned content to produce the analysis; MT uses it
            // to build coverage. Mark the source loaded so nudges stop.
            analysisSaved = true;
          }
          if (
            (tool.name === "automation_framework_generate" || tool.name === "script_save") &&
            text.startsWith("Script saved")
          ) {
            scriptSaved = true;
            const id = text.match(/id=([^\s]+)/)?.[1];
            if (id) push({ type: "artifact", agentId: agent.id, artifact: "script", id });
          } else if (tool.name === "coverage_save" && text.startsWith("Coverage saved")) {
            coverageSaved = true;
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

    // Only mark the agent done if the pipeline was not aborted — otherwise the
    // UI would show "Agent N/6 running…" even though the pipeline stopped.
    if (!opts.signal?.aborted) {
      push({ type: "status", agentId: agent.id, message: `${agent.name} finished` });
      push({ type: "agent_done", agentId: agent.id, code: agent.code, name: agent.name, index: lc.index, total: lc.total });
    }
  } catch (err) {
    const msg =
      err instanceof LlmError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    // Include agent metadata so the client can offer "Retry from this agent".
    push({
      type: "error",
      agentId: agent.id,
      code: agent.code,
      name: agent.name,
      index: lc.index,
      total: lc.total,
      message: msg,
    } as AgentEvent & { code: string; name: string; index: number; total: number });
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
