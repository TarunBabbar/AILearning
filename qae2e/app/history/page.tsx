"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { AppFooter } from "@/components/ui/AppFooter";
import { cn } from "@/lib/utils";
import {
  History,
  Loader2,
  CheckCircle2,
  XCircle,
  PauseCircle,
  FileCode2,
  ArrowRight,
  Search,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from "lucide-react";

type RunStatus = "success" | "partial" | "failed" | "stopped";

interface RunListItem {
  id: string;
  title: string;
  source: string;
  status: RunStatus;
  startedAt: string;
  finishedAt: string;
  counts: { testCases: number; scripts: number; defects: number; releases: number; evaluations?: number };
  testRun?: { ok: boolean; passed: number; failed: number; total: number };
  agents: Array<{ code: string; status: string }>;
  evaluations?: Array<{ agentCode: string; stage: string; precision: number; accuracy: number }>;
}

const STATUS_FILTERS: Array<{ key: RunStatus | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "success", label: "Success" },
  { key: "partial", label: "Partial" },
  { key: "failed", label: "Failed" },
  { key: "stopped", label: "Stopped" },
];

export default function HistoryPage() {
  const [runs, setRuns] = useState<RunListItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [filter, setFilter] = useState<RunStatus | "all">("all");
  const [query, setQuery] = useState("");

  const workspaceId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("workspaceId") || "" : "";

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/runs?limit=200&workspaceId=${encodeURIComponent(workspaceId)}`);
      const d = await res.json();
      setRuns(d.runs || []);
    } catch {
      setRuns([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const download = async (id: string) => {
    setDownloading(id);
    try {
      const res = await fetch(`/api/runs?id=${id}&download=1&workspaceId=${encodeURIComponent(workspaceId)}`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cd = res.headers.get("Content-Disposition") || "";
      const m = cd.match(/filename="([^"]+)"/);
      a.download = m ? m[1] : `qae2e-run-${id.slice(0, 8)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    } finally {
      setDownloading(null);
    }
  };

  const filtered = useMemo(() => {
    if (!runs) return [];
    const q = query.trim().toLowerCase();
    return runs.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (q && !r.title.toLowerCase().includes(q) && !r.id.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [runs, filter, query]);

  const stats = useMemo(() => {
    const total = runs?.length || 0;
    const success = runs?.filter((r) => r.status === "success").length || 0;
    const failed = runs?.filter((r) => r.status === "failed").length || 0;
    return { total, success, failed };
  }, [runs]);

  const statusTone = (s: RunStatus) =>
    s === "success" ? "text-emerald-700" : s === "partial" ? "text-amber-600" : s === "failed" ? "text-red-600" : "text-text-muted";
  const statusIcon = (s: RunStatus) =>
    s === "success" ? <CheckCircle2 size={14} /> : s === "failed" ? <XCircle size={14} /> : s === "partial" ? <PauseCircle size={14} /> : <PauseCircle size={14} />;
  const statusPill = (s: RunStatus) =>
    cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold",
      s === "success" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700" : s === "failed" ? "border-red-500/40 bg-red-500/10 text-red-600" : s === "partial" ? "border-amber-500/40 bg-amber-500/10 text-amber-700" : "border-border bg-bg-surface text-text-muted"
    );

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-border bg-bg-page/80 backdrop-blur-xl">
        <div className="mx-auto max-w-5xl px-6 h-[64px] flex items-center gap-4">
          <Link href="/workspaces" className="flex items-center gap-2 font-bold text-text-primary">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500 text-white">
              <History size={15} />
            </span>
            QAE2E
          </Link>
          <span className="text-sm text-text-muted hidden md:inline">Run history</span>
          <div className="ml-auto flex items-center gap-2.5">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 min-h-9 px-4 rounded-lg bg-amber-500 text-white text-sm font-semibold shadow-sm hover:bg-amber-600 transition-colors"
            >
              <Sparkles size={14} /> Home
            </Link>
            <Link
              href={`/trends?workspaceId=${encodeURIComponent(workspaceId)}`}
              className="inline-flex items-center gap-1.5 min-h-9 px-4 rounded-lg border border-border text-text-secondary text-sm font-semibold hover:bg-bg-hover transition-colors"
            >
              <TrendingUp size={14} /> Trends
            </Link>
            <Link
              href={`/workspace?workspaceId=${encodeURIComponent(workspaceId)}`}
              className="inline-flex items-center gap-1.5 min-h-9 px-4 rounded-lg bg-amber-500 text-white text-sm font-semibold shadow-sm hover:bg-amber-600 transition-colors"
            >
              Open workspace <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Run history</h1>
            <p className="mt-1 text-sm text-text-secondary">Every pipeline run, its artifacts, and downloadable bundles.</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={load} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-semibold text-text-muted hover:text-amber-700 hover:border-amber-500/40 transition-colors">
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
        </div>

        {/* Summary stats */}
        {runs && runs.length > 0 && (
          <div className="mt-6 grid grid-cols-3 gap-3">
            <Stat label="Total runs" value={String(stats.total)} tone="text-text-primary" />
            <Stat label="Succeeded" value={String(stats.success)} tone="text-emerald-700" />
            <Stat label="Failed" value={String(stats.failed)} tone="text-red-600" />
          </div>
        )}

        {/* Filters + search */}
        <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-bg-surface p-1">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-semibold transition-colors",
                  filter === f.key ? "bg-amber-500/15 text-amber-700" : "text-text-muted hover:bg-bg-hover"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative sm:ml-auto sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title or id…"
              className="w-full rounded-lg border border-border-input bg-bg-input pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Runs table */}
        <Card className="mt-6 overflow-hidden">
          {loading && !runs ? (
            <div className="p-8 flex items-center justify-center gap-2 text-sm text-text-muted">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> Loading runs…
            </div>
          ) : !runs || runs.length === 0 ? (
            <p className="p-6 text-sm text-text-muted">No saved runs yet. Run the pipeline to create one.</p>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-sm text-text-muted">No runs match the current filter.</p>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((r) => (
                <div key={r.id} className="flex items-center gap-4 px-5 py-4 hover:bg-bg-hover/40 transition-colors">
                  <span className={cn("shrink-0", statusTone(r.status))}>{statusIcon(r.status)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/history/${encodeURIComponent(r.id)}?workspaceId=${encodeURIComponent(workspaceId)}`}
                        className="text-sm font-semibold text-text-primary truncate hover:text-amber-700 hover:underline"
                      >
                        {r.title}
                      </Link>
                      <span className={statusPill(r.status)}>{r.status}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-text-muted">
                      {new Date(r.startedAt).toLocaleString()}
                      {r.source ? ` · ${r.source}` : ""} · {r.counts.testCases} cases · {r.counts.scripts} scripts · {r.counts.defects} defects
                      {typeof r.testRun?.total === "number" ? ` · tests ${r.testRun.passed}/${r.testRun.total} passed` : ""}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                      {r.agents.map((a) => (
                        <span key={a.code} className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full border", a.status === "done" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : a.status === "error" ? "border-red-500/30 bg-red-500/10 text-red-600" : "border-border bg-bg-surface text-text-muted")}>
                          {a.code}
                        </span>
                      ))}
                      {r.evaluations?.map((ev) => (
                        <span key={`${ev.agentCode}-${ev.stage}`} title={`${ev.stage} — precision ${ev.precision}% / accuracy ${ev.accuracy}%`} className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-700">
                          {ev.agentCode} P{ev.precision}/A{ev.accuracy}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => download(r.id)}
                    disabled={downloading === r.id}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 disabled:opacity-50"
                    title="Download ZIP (code + logs + results)"
                  >
                    {downloading === r.id ? <Loader2 size={12} className="animate-spin" /> : <FileCode2 size={12} />}
                    {downloading === r.id ? "…" : "Download ZIP"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>
      <AppFooter />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg-surface p-3.5 text-center">
      <p className={cn("text-2xl font-bold", tone)}>{value}</p>
      <p className="text-[11px] text-text-muted">{label}</p>
    </div>
  );
}
