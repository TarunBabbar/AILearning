"use client";

import { useMemo, useState } from "react";
import type { AgentEvent } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Bug,
  Rocket,
  TestTube2,
  GitBranch,
  Copy,
  Check,
  PauseCircle,
} from "lucide-react";

interface AgentStatus {
  code: string;
  name: string;
  index: number;
  total: number;
  status: "running" | "done" | "error" | "skipped";
  issues: string[];
  artifacts: string[];
}

export function PipelineSummary({ events }: { events: AgentEvent[] }) {
  const [copied, setCopied] = useState(false);

  const { agents, issues, ranTests, counts } = useMemo(() => {
    const map = new Map<string, AgentStatus>();
    let chainStopped = false;

    for (const e of events) {
      if (e.type === "agent_start") {
        map.set(e.agentId, {
          code: e.code,
          name: e.name,
          index: e.index,
          total: e.total,
          status: "running",
          issues: [],
          artifacts: [],
        });
      } else if (e.type === "agent_done") {
        const a = map.get(e.agentId);
        if (a && a.status !== "error") a.status = "done";
      } else if (e.type === "error" && map.has(e.agentId)) {
        const a = map.get(e.agentId)!;
        a.status = "error";
        a.issues.push(e.message);
      } else if (e.type === "tool_result" && map.has(e.agentId)) {
        const a = map.get(e.agentId)!;
        if (e.summary.startsWith("ERROR")) a.issues.push(`${e.tool}: ${e.summary}`);
        if (e.summary.startsWith("Requirement saved")) a.artifacts.push("requirement");
        if (e.summary.startsWith("Coverage saved")) a.artifacts.push("coverage");
        if (e.summary.startsWith("Script saved")) a.artifacts.push("scripts");
        if (e.summary.startsWith("Test cycle created")) a.artifacts.push("cycle");
        if (e.summary.startsWith("Defect created")) a.artifacts.push("defects");
      } else if (e.type === "artifact" && map.has(e.agentId)) {
        const a = map.get(e.agentId)!;
        if (!a.artifacts.includes(e.artifact)) a.artifacts.push(e.artifact);
      } else if (e.type === "status" && e.message.includes("pipeline stopped")) {
        chainStopped = true;
      }
    }

    // Mark agents after the first error as "skipped" (chain halted).
    const agentsArr = [...map.values()].sort((a, b) => a.index - b.index);
    let sawError = false;
    for (const a of agentsArr) {
      if (a.status === "error") sawError = true;
      else if (sawError && a.status === "running") a.status = "skipped";
    }

    // Real issues only, in agent order.
    const issues = agentsArr.flatMap((a) =>
      a.issues.length ? a.issues.map((m) => `Agent ${a.index + 1} (${a.code}): ${m}`) : []
    );
    if (chainStopped && issues.length) issues.push("Pipeline stopped after an agent error.");

    const counts = {
      requirements: agentsArr.some((a) => a.artifacts.includes("requirement")) ? 1 : 0,
      analyses: agentsArr.some((a) => a.artifacts.includes("analysis")) ? 1 : 0,
      coverages: agentsArr.some((a) => a.artifacts.includes("coverage")) ? 1 : 0,
      scripts: agentsArr.some((a) => a.artifacts.includes("scripts")) ? 1 : 0,
      cycles: agentsArr.some((a) => a.artifacts.includes("cycle")) ? 1 : 0,
      defects: agentsArr.reduce((n, a) => n + a.artifacts.filter((x) => x === "defects").length, 0),
      releases: agentsArr.some((a) => a.artifacts.includes("release")) ? 1 : 0,
    };
    const ranTests =
      events.some((e) => e.type === "test_run" && e.attempts > 0) ||
      agentsArr.some((a) => a.artifacts.includes("cycle"));

    return { agents: agentsArr, issues, ranTests, counts };
  }, [events]);

  const copySummary = async () => {
    const lines = [
      "QAE2E Run Summary",
      "================",
      ...agents.map((a) => `• Agent ${a.index + 1}/${a.total} (${a.code}): ${a.status}${a.issues.length ? " — " + a.issues.join("; ") : ""}`),
      "",
      `Artifacts: ${counts.requirements} requirement(s), ${counts.analyses} analysis(es), ${counts.coverages} coverage(s), ${counts.scripts} script(s), ${counts.cycles} cycle(s), ${counts.defects} defect(s), ${counts.releases} release(s)`,
      `Tests run: ${ranTests ? "yes" : "no"}`,
      "",
      "Issues:",
      ...(issues.length ? issues.map((i) => `• ${i}`) : ["None"]),
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <TestTube2 size={16} className="text-amber-600" />
        <h3 className="font-semibold text-text-primary">Run summary</h3>
        <button onClick={copySummary} className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-500/10 px-2 py-1 rounded-md">
          {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy summary"}
        </button>
      </div>

      {/* Agent status chips */}
      <div className="flex flex-wrap gap-2">
        {agents.map((a) => (
          <div
            key={a.index}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-semibold",
              a.status === "done" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700" : a.status === "error" ? "border-red-500/40 bg-red-500/10 text-red-600" : a.status === "skipped" ? "border-border bg-bg-page text-text-muted" : "border-amber-500/40 bg-amber-500/10 text-amber-700"
            )}
          >
            {a.status === "done" ? <CheckCircle2 size={12} /> : a.status === "error" ? <XCircle size={12} /> : a.status === "skipped" ? <PauseCircle size={12} /> : <Rocket size={12} />}
            {a.code}
          </div>
        ))}
      </div>

      {/* Artifact counts */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        <Stat label="Test cases" value={counts.coverages ? "saved" : "—"} icon={<FileText size={13} />} tone={counts.coverages ? "text-emerald-700" : "text-text-muted"} />
        <Stat label="Scripts" value={counts.scripts ? "saved" : "—"} icon={<GitBranch size={13} />} tone={counts.scripts ? "text-emerald-700" : "text-text-muted"} />
        <Stat label="Defects" value={counts.defects} icon={<Bug size={13} />} tone={counts.defects ? "text-red-600" : "text-text-muted"} />
        <Stat label="Tests run" value={ranTests ? "yes" : "no"} icon={<Rocket size={13} />} tone={ranTests ? "text-emerald-700" : "text-text-muted"} />
      </div>

      {/* Issues — real ones only */}
      {issues.length > 0 && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-red-600 mb-2 flex items-center gap-1.5">
            <AlertTriangle size={13} /> Issues
          </p>
          <ul className="space-y-1.5">
            {issues.map((i, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs text-text-secondary">
                <span className="mt-1 w-1 h-1 rounded-full bg-red-500 shrink-0" /> {i}
              </li>
            ))}
          </ul>
        </div>
      )}

      {issues.length === 0 && agents.length > 0 && (
        <p className="mt-4 text-xs text-emerald-700 flex items-center gap-1.5">
          <CheckCircle2 size={13} /> All agents completed without errors.
        </p>
      )}
    </Card>
  );
}

function Stat({ label, value, icon, tone }: { label: string; value: number | string; icon: React.ReactNode; tone: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg-page p-2.5">
      <p className={cn("text-lg font-bold", tone)}>{value}</p>
      <p className="text-[11px] text-text-muted flex items-center justify-center gap-1">{icon} {label}</p>
    </div>
  );
}
