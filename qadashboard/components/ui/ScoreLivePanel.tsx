"use client";

import type { ScoreProgress } from "@/lib/score-wave";

/**
 * Live scoring status: rotating ticker + cumulative totals vs full board.
 */
export function ScoreLivePanel({ progress }: { progress: ScoreProgress }) {
  const totalJobs = progress.boardTotal ?? 0;
  const processed =
    progress.processedTotal ??
    progress.completed ??
    progress.scored ??
    0;
  const matches = progress.strongTotal ?? progress.strongMatches ?? 0;
  // Always derive % from processed / total so it can't disagree with the counters
  const pct =
    totalJobs > 0
      ? Math.min(100, Math.max(1, Math.round((processed / totalJobs) * 100)))
      : Math.max(3, Math.min(100, progress.percent || 0));

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-border bg-bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-text-primary transition-opacity duration-300 min-w-0">
          {progress.ticker}
        </p>
        <p className="text-lg font-semibold text-amber-700 tabular-nums flex-shrink-0">{pct}%</p>
      </div>

      <div className="h-2.5 bg-white rounded-full overflow-hidden border border-border">
        <div
          className="h-full bg-amber-500 transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-md bg-white border border-border px-2.5 py-2">
          <p className="text-[10px] uppercase tracking-wide text-text-muted">Total jobs</p>
          <p className="text-sm font-semibold text-text-primary tabular-nums">
            {totalJobs ? totalJobs.toLocaleString() : "…"}
          </p>
        </div>
        <div className="rounded-md bg-white border border-border px-2.5 py-2">
          <p className="text-[10px] uppercase tracking-wide text-text-muted">Processing</p>
          <p className="text-sm font-semibold text-text-primary tabular-nums">
            {processed.toLocaleString()}
            {totalJobs ? (
              <span className="text-text-muted font-normal">
                {" "}
                / {totalJobs.toLocaleString()}
              </span>
            ) : null}
          </p>
        </div>
        <div className="rounded-md bg-white border border-border px-2.5 py-2">
          <p className="text-[10px] uppercase tracking-wide text-text-muted">Matches so far</p>
          <p className="text-sm font-semibold text-green-600 tabular-nums">
            {matches.toLocaleString()}
            {totalJobs ? (
              <span className="text-text-muted font-normal">
                {" "}
                / {totalJobs.toLocaleString()}
              </span>
            ) : null}
          </p>
        </div>
      </div>
    </div>
  );
}
