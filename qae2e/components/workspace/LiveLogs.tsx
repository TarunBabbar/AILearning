"use client";

// Live pipeline log — app-themed, auto-scrolling feed of everything happening
// during a run: agent start/done, tools called, results, artifacts, AI
// evaluation (LLM judge) activity, test runs, status messages. Matches the
// app's palette.

import { useEffect, useMemo, useRef, useState } from "react";
import type { AgentEvent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { Copy, Check, ListTree, Pause, Play, ArrowDownToLine } from "lucide-react";

type LogLine = {
  id: number;
  ts: string;
  kind: "info" | "agent" | "tool" | "result" | "artifact" | "eval" | "eval-start" | "eval-retry" | "error" | "test" | "output";
  text: string;
};

const AGENT_HEADLINES: Record<string, string> = {
  "requirement-intelligence": "Analyzing the requirement — extracting rules, criteria, risks…",
  "manual-test-case": "Designing manual test coverage from the analysis…",
  "automation-script": "Generating the Playwright automation framework…",
  "execution-defect": "Executing the test cycle and recording results…",
  "devops-execution": "Running the automated pipeline and linking evidence…",
  "quality-intelligence": "Computing release confidence from all artifacts…",
};

const AGENT_SHORT: Record<string, string> = {
  "requirement-intelligence": "Analyze",
  "manual-test-case": "Coverage",
  "automation-script": "Automate",
  "execution-defect": "Execute",
  "devops-execution": "DevOps",
  "quality-intelligence": "Release",
};

// Plain-language tool labels for the log.
const TOOL_LABELS: Record<string, string> = {
  requirement_analyze: "Read requirement",
  requirement_save: "Save requirement",
  coverage_get: "Load test coverage",
  coverage_save: "Save test coverage",
  cases_search: "Search similar cases",
  cases_export: "Export test cases",
  automation_framework_generate: "Generate Playwright framework",
  script_save: "Save scripts",
  script_fix: "Fix scripts",
  cycle_create: "Create test cycle",
  execution_record: "Record execution",
  defect_create: "Raise defect",
  release_confidence: "Compute release confidence",
  connector_status: "Check connector status",
  test_run_local: "Run tests in Docker",
  image_extract: "Extract text from image",
  api_test_generate: "Generate API tests",
};

const ARTIFACT_LABELS: Record<string, string> = {
  requirement: "Requirement",
  analysis: "Analysis",
  coverage: "Test coverage",
  script: "Automation scripts",
  cycle: "Test cycle",
  defect: "Defect",
  release: "Release report",
  evaluation: "Evaluation",
};

function toolLabel(tool: string): string {
  return TOOL_LABELS[tool] || tool.replace(/_/g, " ");
}

function artifactLabel(a: string): string {
  return ARTIFACT_LABELS[a] || a;
}

function stageLabel(stage: string): string {
  return stage.charAt(0).toUpperCase() + stage.slice(1);
}

/** Strip GUIDs + verbose preamble from an error/result line. */
function cleanError(text: string): string {
  let s = text.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "");
  // Strip trailing "id=..." tokens too.
  s = s.replace(/\bid=\S+/gi, "");
  s = s.replace(/\s{2,}/g, " ").trim();
  s = s.replace(/^(ERROR:\s*|Error:\s*)/i, "");
  return s.length > 140 ? s.slice(0, 137) + "…" : s;
}

/** Turn a raw tool result first-line into a friendly, short message. */
function cleanResult(tool: string, first: string): string {
  const label = toolLabel(tool);
  if (/^Analysis requested for requirement/i.test(first)) return `${label} — requirement loaded, analyzing…`;
  if (/^Coverage saved/i.test(first)) return `${label} — ${first.replace(/\bid=[^ ]+/gi, "").trim()} saved`;
  if (/^Requirement saved/i.test(first)) return `${label} — requirement stored`;
  if (/^Script saved/i.test(first)) return `${label} — automation ready`;
  if (/^Test cycle created/i.test(first)) return `${label} — cycle opened`;
  if (/^Defect created/i.test(first)) return `${label} — defect raised`;
  if (/^Release confidence/i.test(first)) return `${label} — confidence computed`;
  // Raw JSON tool results (e.g. coverage_get) — summarize counts, hide ids.
  if (first.startsWith("{")) {
    try {
      const obj = JSON.parse(first) as { testCaseCount?: number; coverageId?: string; product?: string; module?: string };
      if (obj.testCaseCount != null) {
        return `${label} — ${obj.testCaseCount} test case(s) loaded`;
      }
    } catch {
      // fall through
    }
  }
  return cleanError(first) || `${label} done`;
}

/** Collapse a raw model JSON chunk into a one-line summary. */
function summarizeChunk(text: string): string {
  const t = text.trim();
  if (t.startsWith("{")) {
    try {
      const obj = JSON.parse(t) as { summary?: string; requirementId?: string; title?: string };
      if (obj.summary) return `📝 ${obj.summary.slice(0, 160)}${obj.summary.length > 160 ? "…" : ""}`;
      if (obj.title) return `📝 ${obj.title}`;
    } catch {
      // not clean JSON — fall through
    }
  }
  return t.replace(/\s+/g, " ").slice(0, 160);
}

let seq = 0;

export function LiveLogs({ events, running }: { events: AgentEvent[]; running: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [copied, setCopied] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  const lines = useMemo<LogLine[]>(() => {
    const out: LogLine[] = [];
    const t = () => new Date().toLocaleTimeString("en-US", { hour12: false });
    const push = (kind: LogLine["kind"], text: string) => out.push({ id: seq++, ts: t(), kind, text });

    // Collapse consecutive duplicate tool calls (free models often repeat).
    let lastToolLine = "";
    const pendingRerun = new Set<string>();

    for (const e of events) {
      switch (e.type) {
        case "agent_start":
          if (pendingRerun.has(e.agentId)) {
            push("agent", `🔄 Re-running ${e.code} with AI evaluation feedback…`);
            pendingRerun.delete(e.agentId);
          } else {
            push("agent", `▶ Agent ${e.index + 1}/${e.total} (${e.code}) — ${e.name}`);
          }
          push("info", `  ${AGENT_HEADLINES[e.agentId] || "Working…"}`);
          break;
        case "agent_done":
          push("info", `✓ Agent ${e.code} completed.`);
          break;
        case "status":
          push("info", e.message);
          break;
        case "tool_call": {
          const line = `→ ${toolLabel(e.tool)}`;
          if (line === lastToolLine) break; // skip exact repeats
          lastToolLine = line;
          push("tool", line);
          break;
        }
        case "tool_result": {
          const first = e.summary.split("\n")[0];
          if (e.summary.startsWith("ERROR")) push("error", `← ${toolLabel(e.tool)}: ${cleanError(first)}`);
          else push("result", `← ${toolLabel(e.tool)}: ${cleanResult(e.tool, first)}`);
          break;
        }
        case "artifact":
          push("artifact", `📦 ${artifactLabel(e.artifact)} saved`);
          break;
        case "chunk":
          push("output", summarizeChunk(e.text));
          break;
        case "eval_start":
          push("eval-start", `🔍 AI Evaluation — checking ${AGENT_SHORT[e.agentId] || stageLabel(e.stage)} output…`);
          break;
        case "eval_retry":
          pendingRerun.add(e.agentId);
          push(
            "eval-retry",
            `🔄 AI Evaluation re-run ${e.attempt}/${e.maxAttempts} — ${AGENT_SHORT[e.agentId] || stageLabel(e.stage)} scored P${e.precision} A${e.accuracy}; sending feedback to the agent…`
          );
          break;
        case "evaluation": {
          const verdict =
            e.precision >= 85 && e.accuracy >= 85 ? "Excellent" : e.precision >= 60 && e.accuracy >= 60 ? "Good" : "Needs work";
          const extras: string[] = [];
          if (e.completeness != null) extras.push(`completeness ${e.completeness}%`);
          if (e.missedCount != null) extras.push(`${e.missedCount} missed`);
          if (e.hallucinatedCount != null && e.hallucinatedCount > 0) extras.push(`${e.hallucinatedCount} hallucinated`);
          const suffix = extras.length ? ` (${extras.join(", ")})` : "";
          push("eval", `⭐ AI Evaluation ${stageLabel(e.stage)}: precision ${e.precision}% · accuracy ${e.accuracy}%${suffix} — ${verdict}`);
          break;
        }
        case "error":
          push("error", `✗ ${cleanError(e.message)}`);
          break;
        case "test_run":
          push(
            "test",
            `🧪 Tests: ${e.passed} passed / ${e.failed} failed / ${e.skipped} skipped (${e.total} total, ${e.attempts} attempt${e.attempts === 1 ? "" : "s"})`
          );
          if (e.message) push("test", `  ${e.message}`);
          break;
        default:
          break;
      }
    }
    return out;
  }, [events]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && autoScroll && !paused) el.scrollTop = el.scrollHeight;
  }, [lines.length, autoScroll, paused]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 60);
  };

  const copyLog = async () => {
    const text = lines.map((l) => `[${l.ts}] ${l.text}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  };

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    setAutoScroll(true);
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500/10 text-amber-700">
          <ListTree size={14} />
        </span>
        <h3 className="text-sm font-semibold text-text-primary">Live logs</h3>
        {running && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-emerald-600 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> live
          </span>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          <button
            onClick={() => setPaused((p) => !p)}
            className="p-1.5 rounded-md text-text-muted hover:text-amber-700 hover:bg-amber-500/10 transition-colors"
            title={paused ? "Resume auto-scroll" : "Pause auto-scroll"}
          >
            {paused ? <Play size={13} /> : <Pause size={13} />}
          </button>
          <button
            onClick={scrollToBottom}
            className="p-1.5 rounded-md text-text-muted hover:text-amber-700 hover:bg-amber-500/10 transition-colors"
            title="Jump to latest"
          >
            <ArrowDownToLine size={13} />
          </button>
          <button
            onClick={copyLog}
            className="p-1.5 rounded-md text-text-muted hover:text-amber-700 hover:bg-amber-500/10 transition-colors"
            title="Copy full log"
          >
            {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
          </button>
        </div>
      </div>

      {lines.length === 0 && !running ? (
        <p className="text-xs text-text-muted py-6 text-center">
          Live logs will stream here as soon as you run the pipeline.
        </p>
      ) : (
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="h-[320px] overflow-y-auto rounded-xl border border-border bg-bg-page/70 px-3.5 py-2.5 space-y-1"
        >
          {lines.slice(-300).map((l) => (
            <div key={l.id} className="flex gap-2 text-[11.5px] leading-relaxed">
              <span className="text-text-muted/70 shrink-0 select-none tabular-nums">{l.ts}</span>
              <span
                className={cn(
                  "whitespace-pre-wrap break-words min-w-0 flex-1",
                  l.kind === "agent" && "text-amber-700 font-semibold",
                  l.kind === "info" && "text-text-secondary",
                  l.kind === "tool" && "text-sky-700",
                  l.kind === "result" && "text-emerald-700",
                  l.kind === "artifact" && "text-fuchsia-700",
                  l.kind === "eval-start" && "text-emerald-700 italic",
                  l.kind === "eval-retry" && "text-amber-700 font-semibold",
                  l.kind === "eval" && "text-emerald-700 font-semibold",
                  l.kind === "error" && "text-red-600",
                  l.kind === "test" && "text-cyan-700",
                  l.kind === "output" && "text-text-muted italic"
                )}
              >
                {l.text}
              </span>
            </div>
          ))}
          {running && (
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> live — streaming…
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
