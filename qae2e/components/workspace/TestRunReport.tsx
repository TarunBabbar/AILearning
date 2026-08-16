"use client";

import type { Evaluation } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { CheckCircle2, Container, XCircle } from "lucide-react";
import { EvaluationCard } from "@/components/workspace/EvaluationCard";

export type TestRunSnapshot = {
  ok: boolean;
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  attempts: number;
  failures?: Array<{ test: string; message: string }>;
  logs?: string[];
  message?: string;
};

export function TestRunReport({ run, evaluation }: { run: TestRunSnapshot | null; evaluation?: Evaluation | null }) {
  if (!run) return null;
  const notRun = run.attempts === 0;

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-3">
        <Container size={16} className={notRun ? "text-text-muted" : "text-amber-600"} />
        <h3 className="font-semibold text-text-primary">Test execution</h3>
        {run.ok ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 ml-auto">
            <CheckCircle2 size={13} /> Passed
          </span>
        ) : notRun ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 ml-auto">
            <XCircle size={13} /> Not run
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 ml-auto">
            <XCircle size={13} /> Failed
          </span>
        )}
      </div>

      {notRun && (
        <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3">
          <p className="text-sm text-text-primary">
            <span className="font-bold text-amber-700">Tests could not run automatically.</span>{" "}
            {run.message || "No test executor was available."}
          </p>
          <p className="mt-1 text-xs text-text-secondary leading-relaxed">
            The pipeline needs a Docker engine or a configured remote runner to execute the generated Playwright
            suite. On this deployment, tests were skipped — the execution agents correctly reported no real run.
            To enable real test execution: run Docker locally, or set <code className="font-mono">TEST_RUNNER_URL</code>{" "}
            to a machine that has Docker (see README → Remote Docker runner).
          </p>
        </div>
      )}

      {evaluation && (
        <div className="mb-4">
          <EvaluationCard
            stageLabel="Execute"
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

      {run.message && !notRun && <p className="text-sm text-text-secondary mb-4">{run.message}</p>}

      <div className="grid grid-cols-4 gap-2 text-center">
        <Metric label="Passed" value={run.passed} tone="text-emerald-700" />
        <Metric label="Failed" value={run.failed} tone="text-red-600" />
        <Metric label="Skipped" value={run.skipped} tone="text-text-muted" />
        <Metric label="Total" value={run.total} tone="text-text-primary" />
      </div>

      <p className="mt-2 text-xs text-text-muted">Attempts: {run.attempts}</p>

      {!!run.failures?.length && (
        <ul className="mt-4 space-y-2">
          {run.failures.slice(0, 8).map((f, i) => (
            <li key={i} className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs">
              <p className="font-semibold text-red-700 font-mono">{f.test}</p>
              <p className="text-text-secondary mt-0.5 whitespace-pre-wrap">{f.message.slice(0, 240)}</p>
            </li>
          ))}
        </ul>
      )}

      {!!run.logs?.length && (
        <div className="mt-4 max-h-[200px] overflow-y-auto rounded-lg border border-border bg-bg-code p-3 font-mono text-[11px] text-[#e8e0d1] space-y-1">
          {run.logs.map((line, i) => (
            <p key={i} className="whitespace-pre-wrap">
              {line}
            </p>
          ))}
        </div>
      )}
    </Card>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg-page p-2.5">
      <p className={cn("text-lg font-bold", tone)}>{value}</p>
      <p className="text-[11px] text-text-muted">{label}</p>
    </div>
  );
}
