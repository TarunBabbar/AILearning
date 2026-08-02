"use client";

import type { ReleaseReport } from "@/lib/types";

export function ReleaseGauge({ report }: { report: ReleaseReport | null }) {
  const confidence = report?.confidence ?? 0;
  const risk = report?.risk ?? "—";
  const tone =
    confidence >= 80 ? "text-emerald-700" : confidence >= 55 ? "text-amber-600" : "text-red-700";

  const ring = 2 * Math.PI * 54; // r=54
  const dash = (confidence / 100) * ring;

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

      {report && (
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Metric label="Coverage" value={`${report.coveragePercent}%`} />
          <Metric label="Pass rate" value={`${report.passRate}%`} />
          <Metric label="Open defects" value={String(report.openDefects)} />
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg-page p-2.5">
      <p className="text-lg font-bold text-text-primary">{value}</p>
      <p className="text-[11px] text-text-muted">{label}</p>
    </div>
  );
}
