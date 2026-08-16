"use client";

// AI evaluation card — shows precision/accuracy for one lifecycle stage, a
// plain-language verdict, what the scores mean, actionable ways to improve,
// and expandable per-item verdicts. Powered by an LLM judge (EVAL_MODEL).

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { Gauge, ChevronDown, CheckCircle2, XCircle, MinusCircle, TrendingUp } from "lucide-react";
import type { EvalItemVerdict } from "@/lib/types";

function verdictInfo(v?: string) {
  switch (v) {
    case "excellent":
      return { label: "Excellent", tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700" };
    case "good":
      return { label: "Good", tone: "border-emerald-500/30 bg-emerald-500/5 text-emerald-700" };
    case "needs-work":
      return { label: "Needs work", tone: "border-amber-500/40 bg-amber-500/10 text-amber-700" };
    case "poor":
      return { label: "Poor", tone: "border-red-500/40 bg-red-500/10 text-red-600" };
    default:
      return { label: "Estimate (fallback)", tone: "border-border bg-bg-surface text-text-muted" };
  }
}

function tone(v: number): { color: string; text: string } {
  if (v >= 85) return { color: "bg-emerald-500", text: "text-emerald-700" };
  if (v >= 60) return { color: "bg-amber-500", text: "text-amber-700" };
  return { color: "bg-red-500", text: "text-red-600" };
}

export function EvaluationCard({
  stageLabel,
  precision,
  accuracy,
  rationale,
  overall,
  improvements = [],
  verdict,
  metrics,
  perItem = [],
}: {
  stageLabel: string;
  precision: number;
  accuracy: number;
  rationale?: string;
  overall?: string;
  improvements?: string[];
  verdict?: string;
  metrics?: {
    completeness?: number;
    hallucinatedCount?: number;
    missedCount?: number;
    judgeConfidence?: number;
  };
  perItem?: EvalItemVerdict[];
}) {
  const [open, setOpen] = useState(false);
  const p = tone(precision);
  const a = tone(accuracy);
  const v = verdictInfo(verdict);
  const failed = perItem.filter((x) => x.verdict !== "pass");

  return (
    <Card className="p-4 border-emerald-500/20 bg-emerald-500/[0.03]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-text-muted">
          <Gauge size={13} className="text-emerald-600" />
          {stageLabel} evaluation
        </span>
        <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-bold border", v.tone)}>{v.label}</span>
      </div>

      {/* Precision + accuracy with one-line meaning */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Metric label="Precision" value={precision} bar={p.color} text={p.text} help="How much of what was produced is correct & relevant — no made-up or off-topic content." />
        <Metric label="Accuracy" value={accuracy} bar={a.color} text={a.text} help="How much of what was asked for actually got delivered — nothing missed." />
      </div>

      {/* Extra metrics */}
      {metrics && (
        <div className="mt-3 rounded-lg border border-border bg-bg-page divide-y divide-border">
          <MetricRow label="Completeness" value={perItem.length && metrics.completeness != null ? `${metrics.completeness}%` : "—"} hint="Share of judged items that fully passed" />
          <MetricRow label="Hallucinated" value={perItem.length && metrics.hallucinatedCount != null ? String(metrics.hallucinatedCount) : "—"} hint="Output items that were made up / off-topic" />
          <MetricRow label="Missed asks" value={perItem.length && metrics.missedCount != null ? String(metrics.missedCount) : "—"} hint="Requirement points not fully delivered" />
          <MetricRow label="Judge confidence" value={metrics.judgeConfidence != null ? `${metrics.judgeConfidence}%` : "—"} hint="How sure the judge is of these scores" />
        </div>
      )}

      {overall && <p className="mt-3 text-xs text-text-secondary leading-relaxed">{overall}</p>}
      {!overall && rationale && <p className="mt-3 text-xs text-text-secondary leading-relaxed">{rationale}</p>}

      {/* How to improve */}
      {improvements.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700 mb-1.5 flex items-center gap-1.5">
            <TrendingUp size={12} /> How to raise this score
          </p>
          <ul className="space-y-1">
            {improvements.map((imp, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-text-secondary">
                <span className="mt-1 w-1 h-1 rounded-full bg-amber-500 shrink-0" /> {imp}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Per-item verdicts */}
      {perItem.length > 0 && (
        <button
          onClick={() => setOpen((o) => !o)}
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
        >
          <ChevronDown size={12} className={cn("transition-transform", open && "rotate-180")} />
          {open ? "Hide" : "Show"} item verdicts ({perItem.length}){failed.length > 0 ? ` · ${failed.length} need attention` : ""}
        </button>
      )}

      {open && (
        <ul className="mt-2 space-y-1.5 max-h-56 overflow-y-auto">
          {perItem.map((v2, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-text-secondary">
              {v2.verdict === "pass" ? (
                <CheckCircle2 size={13} className="text-emerald-600 shrink-0 mt-0.5" />
              ) : v2.verdict === "fail" ? (
                <XCircle size={13} className="text-red-500 shrink-0 mt-0.5" />
              ) : (
                <MinusCircle size={13} className="text-amber-500 shrink-0 mt-0.5" />
              )}
              <span>
                <span className="font-medium text-text-primary">{v2.item}</span>
                {v2.reason && <span className="text-text-muted"> — {v2.reason}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Metric({ label, value, bar, text, help }: { label: string; value: number; bar: string; text: string; help: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="min-w-[120px]">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wide text-text-muted cursor-help" onClick={() => setShow((s) => !s)} title="What this means">
          {label} <span className="text-text-muted/50">ⓘ</span>
        </span>
        <span className={cn("text-sm font-bold", text)}>{value}%</span>
      </div>
      <div className="mt-1 h-1.5 w-full rounded-full bg-bg-page overflow-hidden">
        <div className={cn("h-full rounded-full", bar)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
      {show && <p className="mt-1 text-[10px] text-text-muted leading-snug">{help}</p>}
    </div>
  );
}

function MetricRow({ label, value, hint }: { label: string; value: string; hint: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 cursor-help" onClick={() => setShow((s) => !s)} title={hint}>
      <span className="text-xs text-text-secondary flex items-center gap-1">
        {label} <span className="text-text-muted/50">ⓘ</span>
      </span>
      <span className="text-sm font-bold text-text-primary">{value}</span>
      {show && <span className="text-[10px] text-text-muted leading-snug flex-1 text-right">{hint}</span>}
    </div>
  );
}
