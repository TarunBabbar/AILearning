"use client";

import type { Analysis, Coverage, Cycle, Defect, ReleaseReport, Requirement, Script } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CircleDot, FileText, ListChecks, FileCode2, Play, Bug, ShieldCheck, Loader2 } from "lucide-react";

type NodeState = "todo" | "running" | "done" | "warn";

export function TraceabilityRail({
  requirement,
  analysis,
  coverage,
  script,
  cycle,
  defects,
  release,
  running,
  currentAgentCode,
  doneSteps,
}: {
  requirement: Requirement | null;
  analysis: Analysis | null;
  coverage: Coverage | null;
  script: Script | null;
  cycle: Cycle | null;
  defects: Defect[];
  release: ReleaseReport | null;
  running?: boolean;
  currentAgentCode?: string | null;
  doneSteps?: Set<string>;
}) {
  const done = doneSteps || new Set<string>();
  const code = currentAgentCode || null;

  const stateFor = (opts: {
    hasArtifact: boolean;
    stepKey?: string;
    agentCodes?: string[];
    emptyWarn?: boolean;
  }): NodeState => {
    if (opts.hasArtifact) return opts.emptyWarn ? "warn" : "done";
    if (opts.stepKey && done.has(opts.stepKey)) return "done";
    if (running && opts.agentCodes?.includes(code || "")) return "running";
    return "todo";
  };

  const nodes: Array<{
    icon: typeof CircleDot;
    label: string;
    detail: string;
    state: NodeState;
  }> = [
    {
      icon: CircleDot,
      label: "Requirement",
      detail: requirement ? requirement.title : "—",
      state: requirement ? "done" : running ? "running" : "todo",
    },
    {
      icon: FileText,
      label: "AI Analysis",
      detail: analysis
        ? `${analysis.acceptanceCriteria.length} AC · ${analysis.risks.length} risks`
        : code === "RI"
          ? "Analyzing…"
          : "—",
      state: stateFor({ hasArtifact: Boolean(analysis), stepKey: "analyze", agentCodes: ["RI"] }),
    },
    {
      icon: ListChecks,
      label: "Coverage",
      detail: coverage ? `${coverage.testCases.length} test cases` : code === "MT" ? "Designing…" : "—",
      state: stateFor({ hasArtifact: Boolean(coverage), stepKey: "coverage", agentCodes: ["MT"] }),
    },
    {
      icon: FileCode2,
      label: "Automation",
      detail: script
        ? `${script.framework} · ${script.files.length} file(s)`
        : code === "AS"
          ? "Generating…"
          : "—",
      state: stateFor({ hasArtifact: Boolean(script), stepKey: "automate", agentCodes: ["AS"] }),
    },
    {
      icon: Play,
      label: "Execution",
      detail: cycle
        ? `${cycle.executions.filter((e) => e.status === "passed").length}/${cycle.executions.length} passed`
        : code === "EX" || code === "DO"
          ? "Recording…"
          : "—",
      state: stateFor({ hasArtifact: Boolean(cycle), stepKey: "execute", agentCodes: ["EX", "DO"] }),
    },
    {
      icon: Bug,
      label: "Defects",
      detail: defects.length ? `${defects.length} raised` : cycle ? "None" : "—",
      state: defects.length ? "warn" : cycle || done.has("execute") ? "done" : stateFor({ hasArtifact: false, agentCodes: ["EX", "DO"] }),
    },
    {
      icon: ShieldCheck,
      label: "Release",
      detail: release ? `${release.confidence}% confidence` : code === "IQ" ? "Scoring…" : "—",
      state: stateFor({ hasArtifact: Boolean(release), stepKey: "release", agentCodes: ["IQ"] }),
    },
  ];

  return (
    <div className="rounded-xl border border-border bg-bg-surface p-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-muted mb-4">Traceability</p>
      <div className="relative">
        <div className="absolute left-[13px] top-2 bottom-2 w-px bg-border" />
        <ul className="space-y-3">
          {nodes.map((n) => {
            const Icon = n.icon;
            return (
              <li key={n.label} className="relative flex items-start gap-3 pl-1">
                <span
                  className={cn(
                    "relative z-10 flex items-center justify-center w-7 h-7 rounded-full border shrink-0",
                    n.state === "done" && "bg-emerald-500/15 border-emerald-500/50 text-emerald-700",
                    n.state === "running" && "bg-amber-500/15 border-amber-500/50 text-amber-700",
                    n.state === "warn" && "bg-amber-500/10 border-amber-500/40 text-amber-700",
                    n.state === "todo" && "bg-bg-page border-border text-text-muted"
                  )}
                >
                  {n.state === "running" ? <Loader2 size={13} className="animate-spin" /> : <Icon size={13} />}
                </span>
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-xs font-semibold",
                      n.state === "done" && "text-emerald-800",
                      n.state === "running" && "text-amber-800",
                      n.state === "todo" && "text-text-primary",
                      n.state === "warn" && "text-amber-800"
                    )}
                  >
                    {n.label}
                    {n.state === "running" && <span className="ml-1.5 font-normal text-amber-700">live</span>}
                  </p>
                  <p className="text-[11px] text-text-muted truncate">{n.detail}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
