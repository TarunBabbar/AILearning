"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AgentEvent } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Filter,
  Sparkles,
  Clock,
  AlertTriangle,
} from "lucide-react";

type FilterKey = "all" | "tools" | "output" | "errors";

interface ToolStep {
  call?: AgentEvent & { type: "tool_call" };
  result?: AgentEvent & { type: "tool_result" };
}

interface AgentGroup {
  agentId: string;
  code: string;
  name: string;
  index: number;
  total: number;
  status: "running" | "done" | "error";
  startedAt: number;
  finishedAt?: number;
  steps: ToolStep[];
  output?: AgentEvent & { type: "chunk" };
  artifacts: string[];
  issues: string[];
}

export function AgentStream({ events }: { events: AgentEvent[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(Date.now());

  // Tick so running durations update.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    // Scroll only the log container, not the whole page.
    const parent = bottomRef.current?.closest(".agent-log-scroll");
    if (parent) parent.scrollTop = parent.scrollHeight;
  }, [events.length]);

  // Group flat events into per-agent sections with tool call/result pairs.
  const groups = useMemo<AgentGroup[]>(() => {
    const out: AgentGroup[] = [];
    let current: AgentGroup | null = null;

    for (const e of events) {
      if (e.type === "agent_start") {
        current = {
          agentId: e.agentId,
          code: e.code,
          name: e.name,
          index: e.index,
          total: e.total,
          status: "running",
          startedAt: e.ts || Date.now(),
          steps: [],
          artifacts: [],
          issues: [],
        };
        out.push(current);
      } else if (e.type === "agent_done") {
        if (current && current.agentId === e.agentId) {
          current.status = "done";
          current.finishedAt = e.ts || Date.now();
        } else {
          const g = out.find((x) => x.agentId === e.agentId);
          if (g) g.status = "done";
        }
      } else if (current) {
        if (e.type === "tool_call") {
          current.steps.push({ call: e });
        } else if (e.type === "tool_result") {
          const last = current.steps.find((s) => s.call?.tool === e.tool && !s.result);
          if (last) last.result = e;
          else current.steps.push({ result: e });
          if (e.summary.startsWith("ERROR")) current.issues.push(`${e.tool}: ${e.summary}`);
          else if (e.summary.startsWith("NOTE:")) current.issues.push(`ℹ️ ${e.tool}: ${e.summary.split("\n")[0]}`);
          else if (e.summary.startsWith("Requirement saved")) current.artifacts.push("requirement");
          else if (e.summary.startsWith("Coverage saved")) current.artifacts.push("coverage");
          else if (e.summary.startsWith("Script saved")) current.artifacts.push("scripts");
          else if (e.summary.startsWith("Test cycle created")) current.artifacts.push("cycle");
          else if (e.summary.startsWith("Defect created")) current.artifacts.push("defects");
        } else if (e.type === "chunk") {
          current.output = e;
        } else if (e.type === "artifact") {
          if (!current.artifacts.includes(e.artifact)) current.artifacts.push(e.artifact);
        } else if (e.type === "error") {
          current.status = "error";
          current.issues.push(e.message);
        }
      }
    }
    return out;
  }, [events]);

  const toggleAgent = (id: string) =>
    setExpandedAgents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const expandAll = () => setExpandedAgents(new Set(groups.map((g) => g.agentId + g.index)));
  const collapseAll = () => setExpandedAgents(new Set());

  const filteredGroups = useMemo(() => {
    if (filter === "all") return groups;
    return groups
      .map((g) => {
        let steps = g.steps;
        if (filter === "tools") steps = g.steps.filter((s) => s.call || (s.result && s.result.summary.startsWith("ERROR")));
        else if (filter === "output") steps = g.steps.filter((s) => s.call || s.result);
        else if (filter === "errors") steps = g.steps.filter((s) => s.result?.summary.startsWith("ERROR"));
        return { ...g, steps };
      })
      .filter((g) => g.steps.length > 0 || (filter === "output" && g.output) || (filter === "errors" && g.issues.length));
  }, [groups, filter]);

  const cnt = useMemo(() => {
    const c = { all: events.length, tools: 0, output: 0, errors: 0 };
    for (const e of events) {
      if (e.type === "tool_call" || e.type === "tool_result") c.tools++;
      if (e.type === "chunk" || e.type === "artifact" || e.type === "status") c.output++;
      if (e.type === "error" || (e.type === "tool_result" && e.summary.startsWith("ERROR"))) c.errors++;
    }
    return c;
  }, [events]);

  if (!events.length) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-text-muted">
        Agent activity will stream here as the pipeline runs.
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar: filters + expand/collapse + copy */}
      <div className="flex items-center gap-1 mb-3 border-b border-border pb-2 flex-wrap">
        <Filter size={13} className="text-text-muted mr-1" />
        {(["all", "tools", "output", "errors"] as FilterKey[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wide transition-colors",
              filter === f ? "bg-amber-500/15 text-amber-700" : "text-text-muted hover:bg-bg-hover"
            )}
          >
            {f} <span className="text-text-muted/60">({cnt[f]})</span>
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1">
          <button onClick={expandAll} className="px-2 py-1 rounded-md text-[11px] font-semibold text-text-muted hover:bg-bg-hover">
            Expand all
          </button>
          <button onClick={collapseAll} className="px-2 py-1 rounded-md text-[11px] font-semibold text-text-muted hover:bg-bg-hover">
            Collapse
          </button>
          <CopyAllButton events={events} />
        </div>
      </div>

      <div className="space-y-2">
        {filteredGroups.map((g) => (
          <AgentCard
            key={g.agentId + g.index}
            g={g}
            now={now}
            expanded={expandedAgents.has(g.agentId + g.index) || g.status === "running"}
            onToggle={() => toggleAgent(g.agentId + g.index)}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

const ARTIFACT_LABEL: Record<string, string> = {
  requirement: "Requirement",
  analysis: "Analysis",
  coverage: "Test cases",
  scripts: "Scripts",
  script: "Scripts",
  cycle: "Cycle",
  defects: "Defects",
  release: "Release",
};

function AgentCard({ g, now, expanded, onToggle }: { g: AgentGroup; now: number; expanded: boolean; onToggle: () => void }) {
  const running = g.status === "running";
  const hasError = g.status === "error";
  const elapsedMs = running ? now - g.startedAt : (g.finishedAt || now) - g.startedAt;
  const dur = fmtDuration(elapsedMs);
  const toolCalls = g.steps.filter((s) => s.call).length;
  const toolResults = g.steps.filter((s) => s.result).length;
  const inFlight = g.steps.some((s) => s.call && !s.result);

  return (
    <div
      className={cn(
        "rounded-lg border overflow-hidden transition-colors",
        running ? "border-amber-500/50 bg-amber-500/5 shadow-sm" : hasError ? "border-red-500/40 bg-red-500/5" : "border-border bg-bg-surface",
        !running && !hasError && "opacity-85"
      )}
    >
      {/* Header */}
      <button onClick={onToggle} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left">
        <span className="shrink-0">
          {running ? (
            <Loader2 size={15} className="animate-spin text-amber-600" />
          ) : hasError ? (
            <XCircle size={15} className="text-red-600" />
          ) : (
            <CheckCircle2 size={15} className="text-emerald-600" />
          )}
        </span>
        <span className="text-xs font-bold text-text-primary shrink-0">
          Agent {g.index + 1}/{g.total}: {g.code}
        </span>
        <span className="text-xs text-text-secondary truncate">{g.name}</span>
        {running && inFlight && (
          <span className="text-[11px] text-amber-700 font-semibold flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> working…
          </span>
        )}
        <span className="ml-auto flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-text-muted flex items-center gap-1">
            <Clock size={11} /> {dur}
          </span>
          <span className="text-[11px] text-text-muted">
            {toolCalls > 0 && `${toolCalls} call${toolCalls !== 1 ? "s" : ""}`}
            {toolCalls > 0 && toolResults > 0 && " · "}
            {toolResults > 0 && `${toolResults} result${toolResults !== 1 ? "s" : ""}`}
          </span>
          {g.artifacts.length > 0 && (
            <span className="hidden md:flex items-center gap-1">
              {g.artifacts.slice(0, 4).map((a) => (
                <span key={a} className="px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 text-[10px] font-semibold border border-emerald-500/30">
                  {ARTIFACT_LABEL[a] || a}
                </span>
              ))}
            </span>
          )}
          <span className="text-text-muted">{expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
        </span>
      </button>

      {/* Body */}
      {expanded && (
        <div className="border-t border-border">
          {/* Tool timeline */}
          {g.steps.length > 0 && (
            <div className="py-2">
              {g.steps.map((s, i) => (
                <ToolRow key={i} s={s} running={running} />
              ))}
            </div>
          )}

          {/* Final output */}
          {g.output && (
            <div className="border-t border-border px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted mb-1.5 flex items-center gap-1">
                <Sparkles size={11} /> Agent output
              </p>
              <pre className="whitespace-pre-wrap break-words text-[11px] leading-relaxed text-text-secondary bg-bg-page rounded-md p-2.5 border border-border max-h-[260px] overflow-y-auto">
                {g.output.text}
              </pre>
            </div>
          )}

          {/* Issues within this agent (red errors + amber notes) */}
          {g.issues.length > 0 && (
            <div className="border-t border-border px-4 py-2.5 bg-bg-page/40">
              <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted mb-1">Notices</p>
              {g.issues.map((iss, i) => {
                const isNote = iss.startsWith("ℹ️");
                return (
                  <p key={i} className={cn("text-xs flex items-start gap-1.5", isNote ? "text-amber-600" : "text-red-600")}>
                    {isNote ? <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-500" /> : <XCircle size={12} className="mt-0.5 shrink-0" />} {iss}
                  </p>
                );
              })}
            </div>
          )}

          {g.steps.length === 0 && !g.output && g.issues.length === 0 && (
            <p className="px-4 py-3 text-xs text-text-muted">No activity recorded.</p>
          )}
        </div>
      )}
    </div>
  );
}

function ToolRow({ s, running }: { s: ToolStep; running: boolean }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const waiting = running && s.call && !s.result;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // clipboard unavailable
    }
  };

  const detail =
    s.call && s.result
      ? `CALL ${s.call.tool}\nARGS ${JSON.stringify(s.call.args, null, 2)}\n\nRESULT ${s.result.summary}\n${s.result.text || ""}`
      : s.call
        ? `CALL ${s.call.tool}\nARGS ${JSON.stringify(s.call.args, null, 2)}`
        : s.result
          ? `RESULT ${s.result.summary}\n${s.result.text || ""}`
          : "";

  const err = s.result?.summary.startsWith("ERROR");
  const note = !err && s.result?.summary.startsWith("NOTE:");
  const resultTone = err ? "text-red-600" : note ? "text-amber-600" : "text-emerald-700";

  return (
    <div className={cn("px-4 py-1.5 hover:bg-bg-hover/50", waiting && "bg-amber-500/5")}>
      <div className="flex items-center gap-2 text-xs">
        <span className="shrink-0">
          {waiting ? <Loader2 size={12} className="animate-spin text-amber-600" /> : err ? <XCircle size={12} className="text-red-500" /> : note ? <AlertTriangle size={12} className="text-amber-500" /> : <CheckCircle2 size={12} className="text-emerald-600" />}
        </span>
        <span className="text-sky-700 font-semibold shrink-0">→ {s.call?.tool || "?"}</span>
        {s.call && Object.keys(s.call.args).length > 0 && (
          <span className="text-text-muted truncate">{truncate(JSON.stringify(s.call.args), 100)}</span>
        )}
        {waiting && <span className="text-amber-700 text-[11px] font-semibold shrink-0 animate-pulse">running…</span>}
        {s.result && (
          <span className={cn("truncate", resultTone)}>← {truncate(s.result.summary, 120)}</span>
        )}
        <span className="ml-auto flex items-center gap-1 shrink-0">
          {detail && (
            <button onClick={() => setExpanded((x) => !x)} className="text-text-muted hover:text-text-primary" title={expanded ? "Collapse" : "Expand"}>
              {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          )}
          {detail && (
            <button onClick={() => copy(detail)} className="text-text-muted hover:text-amber-600" title="Copy">
              {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
            </button>
          )}
        </span>
      </div>
      {expanded && detail && (
        <pre className="mt-2 ml-6 whitespace-pre-wrap break-words text-[11px] leading-relaxed text-text-secondary bg-bg-page rounded-md p-2.5 border border-border max-h-[320px] overflow-y-auto">
          {detail}
        </pre>
      )}
    </div>
  );
}

function CopyAllButton({ events }: { events: AgentEvent[] }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const text = serializeLog(events);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wide text-amber-700 hover:bg-amber-500/10 transition-colors"
      title="Copy the full run log"
    >
      {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
      {copied ? "Copied" : "Copy all logs"}
    </button>
  );
}

function serializeLog(events: AgentEvent[]): string {
  const lines: string[] = [];
  for (const e of events) {
    switch (e.type) {
      case "agent_start":
        lines.push(`\n=== Agent ${e.index + 1}/${e.total}: ${e.code} — ${e.name} [started] ===`);
        break;
      case "agent_done":
        lines.push(`--- Agent ${e.index + 1}/${e.total}: ${e.code} — done ---`);
        break;
      case "status":
        lines.push(`[status] ${e.message}`);
        break;
      case "tool_call":
        lines.push(`→ call ${e.tool}`);
        if (Object.keys(e.args).length) lines.push(`  args: ${JSON.stringify(e.args)}`);
        break;
      case "tool_result":
        lines.push(`← ${e.tool}: ${e.summary}`);
        if (e.text) lines.push(`  full: ${e.text}`);
        break;
      case "artifact":
        lines.push(`[artifact] ${e.artifact} (${e.id})`);
        break;
      case "chunk":
        lines.push(`[output]\n${e.text}`);
        break;
      case "error":
        lines.push(`[error] ${e.message}`);
        break;
      case "test_run":
        lines.push(
          `[test_run] ok=${e.ok} passed=${e.passed} failed=${e.failed} skipped=${e.skipped} total=${e.total} attempts=${e.attempts}`
        );
        if (e.message) lines.push(`  ${e.message}`);
        break;
      default:
        lines.push(`[event] ${JSON.stringify(e)}`);
    }
  }
  return lines.join("\n");
}

function truncate(s: string, n: number): string {
  const one = s.split("\n")[0] || s;
  return one.length > n ? one.slice(0, n - 1) + "…" : one;
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}
