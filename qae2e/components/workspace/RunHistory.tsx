"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { History, Loader2, CheckCircle2, XCircle, PauseCircle, FileCode2, RefreshCw, ArrowRight } from "lucide-react";

// Right-rail widget: shows only the 3 most recent runs. The full list lives on
// the dedicated /history page ("View all history →").
const MAX_PREVIEW = 3;

interface RunListItem {
  id: string;
  title: string;
  status: "success" | "partial" | "failed" | "stopped";
  startedAt: string;
  counts: { testCases: number; scripts: number; defects: number };
  agents: Array<{ code: string; status: string }>;
}

export function RunHistory({ workspaceId = "" }: { workspaceId?: string }) {
  const [runs, setRuns] = useState<RunListItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/runs?limit=3&workspaceId=${encodeURIComponent(workspaceId)}`);
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

  const statusTone = (s: string) =>
    s === "success" ? "text-emerald-700" : s === "partial" ? "text-amber-600" : s === "failed" ? "text-red-600" : "text-text-muted";
  const statusIcon = (s: string) =>
    s === "success" ? <CheckCircle2 size={12} /> : s === "failed" ? <XCircle size={12} /> : s === "partial" ? <PauseCircle size={12} /> : <PauseCircle size={12} />;

  const preview = runs?.slice(0, MAX_PREVIEW) || [];

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <History size={16} className="text-amber-600" />
        <h3 className="font-semibold text-text-primary">Run history</h3>
        <button onClick={load} className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-amber-700">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {loading && !runs ? (
        <p className="text-sm text-text-muted flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Loading runs…
        </p>
      ) : !runs || runs.length === 0 ? (
        <p className="text-sm text-text-muted">No saved runs yet. Run the pipeline to create one.</p>
      ) : (
        <>
          <div className="space-y-2">
            {preview.map((r) => (
              <div key={r.id} className="rounded-lg border border-border bg-bg-page p-3 flex items-center gap-3">
                <span className={cn("shrink-0", statusTone(r.status))}>{statusIcon(r.status)}</span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/history/${encodeURIComponent(r.id)}?workspaceId=${encodeURIComponent(workspaceId)}`}
                    className="text-sm font-semibold text-text-primary truncate block hover:text-amber-700 hover:underline"
                  >
                    {r.title}
                  </Link>
                  <p className="text-[11px] text-text-muted">
                    {new Date(r.startedAt).toLocaleString()} · {r.counts.testCases} cases · {r.counts.scripts} scripts · {r.counts.defects} defects
                  </p>
                  <div className="mt-1 flex items-center gap-1">
                    {r.agents.map((a) => (
                      <span key={a.code} className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full border", a.status === "done" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : a.status === "error" ? "border-red-500/30 bg-red-500/10 text-red-600" : "border-border bg-bg-surface text-text-muted")}>
                        {a.code}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => download(r.id)}
                  disabled={downloading === r.id}
                  className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 disabled:opacity-50"
                  title="Download ZIP (code + logs + results)"
                >
                  {downloading === r.id ? <Loader2 size={12} className="animate-spin" /> : <FileCode2 size={12} />}
                  {downloading === r.id ? "…" : "Download"}
                </button>
              </div>
            ))}
          </div>

          {/* View all → dedicated history page */}
          <Link
            href={`/history?workspaceId=${encodeURIComponent(workspaceId)}`}
            className="mt-3 flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-lg border border-border bg-bg-surface text-xs font-semibold text-amber-700 hover:border-amber-500/40 hover:bg-bg-hover transition-colors"
          >
            View all history <ArrowRight size={13} />
          </Link>
        </>
      )}
    </Card>
  );
}
