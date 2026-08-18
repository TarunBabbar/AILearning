"use client";

import { useEffect, useState } from "react";
import { api, MetricScore, Run } from "@/lib/api";

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [metrics, setMetrics] = useState<Record<string, MetricScore[]>>({});
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      const list = await api.listRuns();
      setRuns(list);
      const m: Record<string, MetricScore[]> = {};
      for (const r of list.slice(0, 5)) {
        m[r.id] = await api.runMetrics(r.id);
      }
      setMetrics(m);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function trigger() {
    setRunning(true);
    setError("");
    try {
      await api.triggerRun();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Runs</h2>
        <button
          onClick={trigger}
          disabled={running}
          className="rounded-lg bg-brand-600 px-4 py-2 text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {running ? "Running…" : "Run suite"}
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6 space-y-4">
        {runs.map((run) => (
          <div key={run.id} className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-sm text-slate-500">{run.id.slice(0, 8)}</span>
                <span className="ml-3 rounded bg-slate-100 px-2 py-0.5 text-xs">{run.trigger}</span>
                <span
                  className={`ml-2 rounded px-2 py-0.5 text-xs ${
                    run.gate_verdict === "pass"
                      ? "bg-green-100 text-green-700"
                      : run.gate_verdict === "block"
                      ? "bg-red-100 text-red-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {run.gate_verdict ? `gate: ${run.gate_verdict}` : run.status}
                </span>
              </div>
              <div className="text-xs text-slate-500">
                {run.passed} passed · {run.failed} failed · {run.total} total
              </div>
            </div>
            {metrics[run.id] && metrics[run.id].length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
                {metrics[run.id].map((m) => (
                  <div
                    key={m.metric}
                    className={`rounded-lg border p-3 ${
                      m.passed ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
                    }`}
                  >
                    <div className="text-[10px] uppercase text-slate-500">{m.metric}</div>
                    <div className="mt-1 text-lg font-semibold">
                      {(m.score * 100).toFixed(0)}
                      <span className="text-xs text-slate-400"> / {(m.threshold * 100).toFixed(0)}</span>
                    </div>
                    {m.hard_gate && <div className="mt-1 text-[10px] text-red-600">hard gate</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {runs.length === 0 && <p className="text-sm text-slate-500">No runs yet. Trigger your first suite.</p>}
      </div>
    </div>
  );
}
