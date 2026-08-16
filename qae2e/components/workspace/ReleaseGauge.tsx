"use client";

import type { Evaluation, ReleaseReport } from "@/lib/types";
import { EvaluationCard } from "@/components/workspace/EvaluationCard";
import { cn } from "@/lib/utils";
import { Info } from "lucide-react";

export function ReleaseGauge({ report, evaluation }: { report: ReleaseReport | null; evaluation?: Evaluation | null }) {
  const confidence = report?.confidence ?? 0;
  const risk = report?.risk ?? "—";
  const tone =
    confidence >= 80 ? "text-emerald-700" : confidence >= 55 ? "text-amber-600" : "text-red-700";

  const ring = 2 * Math.PI * 54; // r=54
  const dash = (confidence / 100) * ring;

  // Why this score: explain the deterministic formula in plain terms.
  const coverage = report?.coveragePercent ?? 0;
  const passRate = report?.passRate ?? 0;
  const openDefects = report?.openDefects ?? 0;
  const coverageWeight = Math.round(coverage * 0.4);
  const passWeight = Math.round(passRate * 0.4);
  const defectWeight = openDefects === 0 ? 20 : 10;
  const explainers = [
    { label: "Coverage (40%)", value: coverage, detail: `${coverage}% of cases were executed`, weight: coverageWeight },
    { label: "Pass rate (40%)", value: passRate, detail: `${passRate}% of executed tests passed`, weight: passWeight },
    { label: "Defects (20%)", value: openDefects, detail: openDefects === 0 ? "No open defects — full marks" : `${openDefects} open defect(s) — partial`, weight: defectWeight },
  ];

  const improvements: string[] = [];
  if (coverage < 100) improvements.push(`Execute the remaining ${100 - coverage}% of test cases to raise coverage.`);
  if (passRate < 100) improvements.push(`Fix the ${100 - passRate}% failing tests to raise the pass rate.`);
  if (openDefects > 0) improvements.push(`Resolve the ${openDefects} open defect(s).`);
  if (improvements.length === 0) improvements.push("Everything is green — re-run with more scenarios to keep it that way.");

  return (
    <div className="rounded-xl border border-border bg-bg-surface p-6 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-muted">Release confidence</p>

      <div className="relative mx-auto mt-4 w-40 h-40">
        <svg viewBox="0 0 128 128" className="w-full h-full -rotate-90">
          <circle cx="64" cy="64" r="54" fill="none" stroke="#e6dfd1" strokeWidth="12" />
          <circle
            cx="64"
            cy="64"
            r="54"
            fill="none"
            stroke="#d97706"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${ring}`}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-4xl font-black ${tone}`}>{confidence}%</span>
          <span className="text-xs font-semibold text-text-muted uppercase mt-0.5">risk: {risk}</span>
        </div>
      </div>

      {/* Why this score */}
      {report && (
        <div className="mt-4 text-left rounded-lg border border-border bg-bg-page p-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted mb-2 flex items-center gap-1.5">
            <Info size={12} className="text-amber-600" /> Why {confidence}%
          </p>
          <div className="space-y-1.5">
            {explainers.map((e) => (
              <div key={e.label} className="text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-text-secondary">{e.label}</span>
                  <span className="font-bold text-text-primary">{e.weight}/40 or 20 pts</span>
                </div>
                <div className="mt-0.5 h-1 rounded-full bg-bg-page overflow-hidden">
                  <div
                    className={cn("h-full rounded-full", e.value >= 80 ? "bg-emerald-500" : e.value >= 55 ? "bg-amber-500" : "bg-red-500")}
                    style={{ width: `${Math.max(0, Math.min(100, e.value))}%` }}
                  />
                </div>
                <p className="text-[10px] text-text-muted mt-0.5">{e.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* How to improve */}
      {report && (
        <div className="mt-3 text-left rounded-lg border border-amber-500/25 bg-amber-500/5 p-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700 mb-1.5">How to reach 100%</p>
          <ul className="space-y-1">
            {improvements.map((imp, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-text-secondary">
                <span className="mt-1 w-1 h-1 rounded-full bg-amber-500 shrink-0" /> {imp}
              </li>
            ))}
          </ul>
        </div>
      )}

      {evaluation && (
        <div className="mt-3 text-left">
          <EvaluationCard
            stageLabel="Release report quality"
            precision={evaluation.precision}
            accuracy={evaluation.accuracy}
            rationale={evaluation.rationale}
            overall={evaluation.overall}
            improvements={evaluation.improvements}
            verdict={evaluation.verdict}
            metrics={evaluation.metrics}
            perItem={evaluation.perItem}
          />
        </div>
      )}
    </div>
  );
}
