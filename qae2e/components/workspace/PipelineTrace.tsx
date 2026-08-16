"use client";

// Full live pipeline trace: every stage (agent) with its tools/artifacts, the
// AI evaluation (LLM judge) step that follows it (visible as its own row), and
// the final requirement → release mapping with precision/accuracy.

import { useMemo } from "react";
import type { AgentEvent, Evaluation } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  XCircle,
  Gauge,
  Sparkles,
  ListChecks,
  FileCode2,
  Container,
  Rocket,
  Wrench,
  Scale,
  PauseCircle,
} from "lucide-react";

interface StageInfo {
  key: string;
  label: string;
  agentId: string;
  agentCode: string;
  icon: React.ReactNode;
}

const STAGES: StageInfo[] = [
  { key: "analyze", label: "Analyze requirement", agentId: "requirement-intelligence", agentCode: "RI", icon: <Sparkles size={13} /> },
  { key: "coverage", label: "Design test coverage", agentId: "manual-test-case", agentCode: "MT", icon: <ListChecks size={13} /> },
  { key: "automate", label: "Generate automation", agentId: "automation-script", agentCode: "AS", icon: <FileCode2 size={13} /> },
  { key: "execute", label: "Execute tests", agentId: "execution-defect", agentCode: "EX", icon: <Container size={13} /> },
  { key: "release", label: "Release confidence", agentId: "quality-intelligence", agentCode: "IQ", icon: <Rocket size={13} /> },
];

interface StageState {
  status: string;
  tools: string[];
  artifacts: string[];
  attempts: number; // AI evaluation re-run attempts so far
  rerunning: boolean; // a re-run is the current active agent phase
  testRun?: { ok: boolean; passed: number; failed: number; total: number };
}

export function PipelineTrace({
  events,
  evaluations,
  running,
  evaluating,
}: {
  events: AgentEvent[];
  evaluations: Record<string, Evaluation>;
  running: boolean;
  evaluating: { stage: string; agentCode: string } | null;
}) {
  const trace = useMemo(() => {
    const stageMap = new Map<string, StageState>();
    for (const s of STAGES) stageMap.set(s.key, { status: "pending", tools: [], artifacts: [], attempts: 0, rerunning: false });

    let currentAgentId: string | null = null;
    let pendingRerun = new Set<string>(); // stages whose re-run hasn't started yet
    for (const e of events) {
      if (e.type === "agent_start") {
        currentAgentId = e.agentId;
        const st = STAGES.find((s) => s.agentId === e.agentId);
        if (st) {
          const state = stageMap.get(st.key)!;
          state.status = "running";
          state.rerunning = pendingRerun.has(st.key);
          pendingRerun.delete(st.key);
        }
      } else if (e.type === "agent_done") {
        const st = STAGES.find((s) => s.agentId === e.agentId);
        if (st && stageMap.get(st.key)!.status !== "error") {
          const state = stageMap.get(st.key)!;
          state.status = "done";
          state.rerunning = false;
        }
      } else if (e.type === "eval_retry") {
        const st = STAGES.find((s) => s.agentId === e.agentId);
        if (st) {
          const state = stageMap.get(st.key)!;
          state.attempts = e.attempt;
          state.rerunning = true;
          state.status = "running"; // about to re-run
          pendingRerun.add(st.key);
        }
      } else if (e.type === "error") {
        const st = STAGES.find((s) => s.agentId === e.agentId) || STAGES.find((s) => s.agentId === currentAgentId);
        if (st) stageMap.get(st.key)!.status = "error";
      } else if (e.type === "tool_call") {
        const st = STAGES.find((s) => s.agentId === e.agentId) || STAGES.find((s) => s.agentId === currentAgentId);
        if (st) {
          const t = stageMap.get(st.key)!;
          if (!t.tools.includes(e.tool)) t.tools.push(e.tool);
        }
      } else if (e.type === "artifact") {
        const st = STAGES.find((s) => s.agentId === e.agentId) || STAGES.find((s) => s.agentId === currentAgentId);
        if (st) {
          const t = stageMap.get(st.key)!;
          if (!t.artifacts.includes(e.artifact)) t.artifacts.push(e.artifact);
        }
      } else if (e.type === "test_run") {
        const execute = stageMap.get("execute")!;
        execute.testRun = { ok: e.ok, passed: e.passed, failed: e.failed, total: e.total };
      }
    }

    let sawError = false;
    for (const s of STAGES) {
      const st = stageMap.get(s.key)!;
      if (st.status === "error") sawError = true;
      else if (sawError && st.status === "pending") st.status = "skipped";
    }
    return stageMap;
  }, [events]);

  const doneStages = STAGES.filter((s) => trace.get(s.key)!.status === "done").length;
  const activeStage = STAGES.find((s) => trace.get(s.key)!.status === "running");
  const rerunningStage = STAGES.find((s) => trace.get(s.key)!.rerunning);
  // A stage left mid-flight when the pipeline stopped.
  const stoppedStage = !running ? STAGES.find((s) => trace.get(s.key)!.status === "running" || trace.get(s.key)!.rerunning) : undefined;

  // Interleave: agent stage → its eval row. Skip stages that have never started
  // (no events yet) so the trace doesn't show a wall of "Queued…".
  const rows = useMemo(() => {
    const out: Array<{ kind: "stage" | "eval"; stage: StageInfo; index: number }> = [];
    let seenStarted = false;
    STAGES.forEach((s, i) => {
      const st = trace.get(s.key)!;
      if (st.status !== "pending" && st.status !== "skipped") seenStarted = true;
      if (st.status === "pending" && !seenStarted) return; // hide leading queued stages
      out.push({ kind: "stage", stage: s, index: i });
      out.push({ kind: "eval", stage: s, index: i });
    });
    return out;
  }, [trace]);

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-1">
        <Wrench size={15} className="text-amber-600" />
        <h3 className="font-semibold text-text-primary">Pipeline trace</h3>
        {running && rerunningStage && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> Re-running {rerunningStage.agentCode} with AI evaluation feedback…
          </span>
        )}
        {running && !rerunningStage && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> {activeStage ? `${activeStage.agentCode} working…` : "Starting…"}
          </span>
        )}
        {!running && stoppedStage && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted">
            <PauseCircle size={13} /> Stopped
          </span>
        )}
        {evaluating && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> AI Evaluation judging {evaluating.agentCode}…
          </span>
        )}
        {!running && !evaluating && doneStages > 0 && (
          <span className="ml-auto text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
            <CheckCircle2 size={13} /> {doneStages}/{STAGES.length} stages evaluated
          </span>
        )}
      </div>
      <p className="text-xs text-text-muted mb-4">
        Every step of the pipeline — what each agent produced, and how the AI judge scored it (precision = correct &amp;
        relevant output, accuracy = nothing missed).
      </p>

      <div className="space-y-1.5">
        {rows.map(({ kind, stage, index }) => {
          if (kind === "stage") {
            const st = trace.get(stage.key)!;
            const stopped = !running && (st.status === "running" || st.rerunning);
            const tone =
              st.status === "done"
                ? "border-emerald-500/30 bg-emerald-500/5"
                : st.status === "error"
                  ? "border-red-500/30 bg-red-500/5"
                  : stopped
                    ? "border-border bg-bg-page opacity-70"
                    : st.status === "running"
                      ? "border-amber-500/40 bg-amber-500/5"
                      : st.status === "skipped"
                        ? "border-border bg-bg-page opacity-60"
                        : "border-border bg-bg-page";
            return (
              <div key={`stage-${stage.key}`} className={cn("rounded-lg border px-3.5 py-2.5", tone)}>
                <div className="flex items-center gap-2.5">
                  <span className="flex items-center justify-center w-7 h-7 rounded-md bg-amber-500/10 text-amber-700 shrink-0">{stage.icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary">
                      {index + 1}. {stage.label}
                      <span className="ml-1.5 text-[11px] font-bold text-text-muted">{stage.agentCode}</span>
                    </p>
                    <p className="text-[11px] text-text-muted truncate">
                      {stopped && "Stopped"}
                      {!stopped && st.rerunning && `Re-running with AI evaluation feedback (attempt ${st.attempts}/2)…`}
                      {!stopped && !st.rerunning && st.status === "pending" && "Queued…"}
                      {!stopped && !st.rerunning && st.status === "running" && "Working…"}
                      {!stopped && !st.rerunning && st.status === "done" && (st.attempts > 0 ? `Completed after ${st.attempts + 1} attempt(s)` : "Completed")}
                      {!stopped && !st.rerunning && st.status === "error" && "Failed"}
                      {!stopped && !st.rerunning && st.status === "skipped" && "Skipped (chain stopped)"}
                      {st.tools.length > 0 && ` · ${st.tools.join(", ")}`}
                      {st.artifacts.length > 0 && ` · ${st.artifacts.join(", ")}`}
                      {st.testRun && ` · ${st.testRun.passed}/${st.testRun.total} passed`}
                    </p>
                  </div>
                  <div className="ml-auto shrink-0">
                    {stopped && <PauseCircle size={14} className="text-text-muted" />}
                    {!stopped && st.rerunning && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-700">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> attempt {st.attempts}/2
                      </span>
                    )}
                    {!stopped && !st.rerunning && st.status === "running" && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-700">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> Running
                      </span>
                    )}
                    {!stopped && !st.rerunning && st.status === "done" && <CheckCircle2 size={14} className="text-emerald-600" />}
                    {!stopped && !st.rerunning && st.status === "error" && <XCircle size={14} className="text-red-500" />}
                  </div>
                </div>
              </div>
            );
          }

          // Eval row for this stage
          const ev = evaluations[stage.key];
          const isEvaluating = evaluating?.stage === stage.key;
          const stageState = trace.get(stage.key)!;
          const rerunning = stageState.rerunning;
          const stopped = !running && (rerunning || isEvaluating);
          const tone = ev
            ? ev.verdict === "excellent" || ev.verdict === "good"
              ? "border-emerald-500/25 bg-emerald-500/[0.04]"
              : ev.verdict === "needs-work" || ev.verdict === "poor"
                ? "border-amber-500/25 bg-amber-500/[0.04]"
                : "border-border bg-bg-page"
            : "border-dashed border-border bg-bg-page";
          return (
            <div key={`eval-${stage.key}`} className={cn("rounded-lg border px-3.5 py-2.5", tone)}>
              <div className="flex items-center gap-2.5">
                <span className="flex items-center justify-center w-7 h-7 rounded-md bg-emerald-500/10 text-emerald-700 shrink-0">
                  <Scale size={13} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-primary">
                    AI Evaluation — {stage.label}
                    <span className="ml-1.5 text-[11px] font-bold text-emerald-700">judge</span>
                  </p>
                  <p className="text-[11px] text-text-muted truncate">
                    {stopped && "Stopped"}
                    {!stopped && rerunning && `Re-scoring after re-run…`}
                    {!stopped && !rerunning && isEvaluating && "Scoring precision & accuracy…"}
                    {!stopped && !rerunning && !isEvaluating && ev && ev.overall && ev.overall}
                    {!stopped && !rerunning && !isEvaluating && ev && !ev.overall && `P${ev.precision} · A${ev.accuracy}`}
                    {!stopped && !rerunning && !isEvaluating && !ev && "Will score once the agent produces its output…"}
                  </p>
                </div>
                <div className="ml-auto shrink-0">
                  {stopped && <PauseCircle size={14} className="text-text-muted" />}
                  {!stopped && rerunning && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Re-scoring…
                    </span>
                  )}
                  {!stopped && !rerunning && isEvaluating && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Scoring…
                    </span>
                  )}
                  {!rerunning && !isEvaluating && ev && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-700">
                      <Gauge size={11} /> P{ev.precision} · A{ev.accuracy}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Requirement → stage mapping summary */}
      {doneStages > 0 && (
        <div className="mt-4 rounded-lg border border-border bg-bg-page p-3.5">
          <p className="text-xs font-bold uppercase tracking-wide text-text-muted mb-2 flex items-center gap-1.5">
            <Gauge size={12} className="text-emerald-600" /> Requirement → stage mapping
          </p>
          <ul className="space-y-1">
            {STAGES.map((s) => {
              const st = trace.get(s.key)!;
              const ev = evaluations[s.key];
              if (!ev) return null;
              return (
                <li key={s.key} className="flex items-center gap-2 text-xs text-text-secondary">
                  <span className="w-3 h-3 rounded-full bg-emerald-500/70 shrink-0" />
                  <span className="font-semibold text-text-primary w-24 shrink-0">{s.label}</span>
                  <span className="text-text-muted truncate flex-1">{ev.overall || ev.rationale || "—"}</span>
                  <span className="font-bold text-emerald-700 shrink-0">P{ev.precision} · A{ev.accuracy}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}
