"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { Sparkles, Loader2, TrendingUp, ShieldCheck, TestTube2, RefreshCw, ArrowLeft } from "lucide-react";

interface RunPoint {
  date: string;
  id: string;
  title: string;
  status: string;
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  passRate: number;
}
interface ReleasePoint {
  date: string;
  requirementId: string;
  confidence: number;
  coveragePercent: number;
  passRate: number;
  openDefects: number;
}
interface FlakyRow {
  test: string;
  runs: number;
  passed: number;
  failed: number;
  ratio: number;
  flaky: boolean;
}

interface TrendsData {
  runSeries: RunPoint[];
  releaseSeries: ReleasePoint[];
  flaky: FlakyRow[];
  quarantined: string[];
  totals: { runs: number; releases: number; flakyTests: number };
}

const WIDTH = 640;
const HEIGHT = 180;

function LineChart({
  points,
  label,
  color,
}: {
  points: Array<{ date: string; value: number }>;
  label: string;
  color: string;
}) {
  const { path, area, dots, ticks } = useMemo(() => {
    if (points.length < 2) return { path: "", area: "", dots: [], ticks: [] };
    const pad = 24;
    const innerW = WIDTH - pad * 2;
    const innerH = HEIGHT - pad * 2;
    const xs = points.map((_, i) => pad + (i / (points.length - 1)) * innerW);
    const maxV = Math.max(100, ...points.map((p) => p.value));
    const ys = points.map((p) => pad + innerH - (p.value / maxV) * innerH);
    const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${xs[i].toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
    const areaPath = `${line} L${xs[xs.length - 1].toFixed(1)},${HEIGHT - pad} L${xs[0].toFixed(1)},${HEIGHT - pad} Z`;
    const dotEls = points.map((p, i) => (
      <circle key={i} cx={xs[i]} cy={ys[i]} r={3} fill={color} className="opacity-80" />
    ));
    const tickEls = points
      .map((p, i) => ({ x: xs[i], label: p.date.slice(5) }))
      .filter((_, i) => i % Math.ceil(points.length / 6) === 0)
      .map((t, i) => (
        <text key={i} x={t.x} y={HEIGHT - 6} textAnchor="middle" fontSize={9} fill="#978f85">
          {t.label}
        </text>
      ));
    return { path: line, area: areaPath, dots: dotEls, ticks: tickEls };
  }, [points, color]);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-bold uppercase tracking-wide text-text-muted">{label}</p>
        {points.length > 0 && (
          <span className="text-xs font-semibold text-text-primary">
            {points[points.length - 1].value}
            <span className="text-text-muted font-normal">%</span>
          </span>
        )}
      </div>
      {points.length < 2 ? (
        <div className="h-[180px] flex items-center justify-center text-xs text-text-muted rounded-lg border border-dashed border-border">
          Not enough data yet — run the pipeline to see trends.
        </div>
      ) : (
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto" aria-label={label}>
          <defs>
            <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#grad-${label})`} />
          <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
          {dots}
          {ticks}
        </svg>
      )}
    </div>
  );
}

export default function TrendsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-text-muted">Loading trends…</div>}>
      <TrendsInner />
    </Suspense>
  );
}

function TrendsInner() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspaceId") || "";
  const [data, setData] = useState<TrendsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!workspaceId) {
        setError("Pick a workspace first — open Trends from inside a workspace.");
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/trends?workspaceId=${encodeURIComponent(workspaceId)}`);
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "Failed to load trends");
        setData(d);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [workspaceId]);

  const confidenceSeries = useMemo(
    () => (data?.releaseSeries || []).map((r) => ({ date: r.date, value: r.confidence })),
    [data]
  );
  const passRateSeries = useMemo(
    () =>
      (data?.runSeries || []).map((r) => ({ date: r.date, value: r.passRate })) ||
      (data?.releaseSeries || []).map((r) => ({ date: r.date, value: r.passRate })),
    [data]
  );
  const coverageSeries = useMemo(
    () => (data?.releaseSeries || []).map((r) => ({ date: r.date, value: r.coveragePercent })),
    [data]
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-text-muted">
        <Loader2 size={16} className="animate-spin mr-2" /> Loading trends…
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-border bg-bg-page/80 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-6 h-[64px] flex items-center gap-4">
          <Link href="/workspaces" className="flex items-center gap-2 font-bold text-text-primary">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500 text-white">
              <Sparkles size={15} />
            </span>
            QAE2E
          </Link>
          <span className="text-sm text-text-muted hidden md:inline">Trends</span>
          <div className="ml-auto flex items-center gap-2.5">
            <Link
              href={workspaceId ? `/workspace?workspaceId=${encodeURIComponent(workspaceId)}` : "/workspaces"}
              className="inline-flex items-center gap-1.5 min-h-9 px-4 rounded-lg border border-border text-text-secondary text-sm font-semibold hover:bg-bg-hover transition-colors"
            >
              <ArrowLeft size={14} /> Workspace
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp size={20} className="text-amber-600" />
          <h1 className="text-2xl font-bold text-text-primary">Quality trends</h1>
          {data && (
            <div className="ml-auto flex gap-2">
              <Badge tone="blue">{data.totals.runs} runs</Badge>
              <Badge tone="blue">{data.totals.releases} releases</Badge>
              <Badge tone={data.totals.flakyTests ? "amber" : "green"}>
                {data.totals.flakyTests} flaky
              </Badge>
            </div>
          )}
        </div>

        {error ? (
          <Card className="p-6">
            <p className="text-sm text-red-600">{error}</p>
          </Card>
        ) : !data ? (
          <Card className="p-6 text-sm text-text-muted">No data yet.</Card>
        ) : (
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="p-5">
                <LineChart points={confidenceSeries} label="Release confidence" color="#d97706" />
              </Card>
              <Card className="p-5">
                <LineChart points={passRateSeries} label="Test pass rate" color="#059669" />
              </Card>
            </div>
            <Card className="p-5">
              <LineChart points={coverageSeries} label="Coverage %" color="#0e7490" />
            </Card>

            {/* Flaky tests + quarantine */}
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <RefreshCw size={15} className="text-amber-600" />
                  <h3 className="font-semibold text-text-primary">Flaky tests</h3>
                </div>
                {data.flaky.length === 0 ? (
                  <p className="text-xs text-text-muted">No per-test history yet — run the suite a few times.</p>
                ) : (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {data.flaky.slice(0, 30).map((f) => (
                      <div key={f.test} className="flex items-center justify-between text-xs">
                        <span className={cn("truncate flex-1 mr-2", f.flaky && "text-red-600 font-semibold")}>
                          {f.test}
                        </span>
                        <span className="text-text-muted shrink-0">
                          {f.passed}p/{f.failed}f · {Math.round(f.ratio * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
              <Card className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck size={15} className="text-amber-600" />
                  <h3 className="font-semibold text-text-primary">Quarantined</h3>
                </div>
                {data.quarantined.length === 0 ? (
                  <p className="text-xs text-text-muted">No tests quarantined. Auto-quarantine candidates: {data.flaky.filter((f) => f.flaky).length}.</p>
                ) : (
                  <ul className="space-y-1.5 max-h-64 overflow-y-auto">
                    {data.quarantined.map((t) => (
                      <li key={t} className="text-xs text-text-secondary truncate font-mono">{t}</li>
                    ))}
                  </ul>
                )}
                <p className="mt-3 text-[11px] text-text-muted">
                  Quarantined tests are excluded from runs via --grep-invert. Toggle from the flaky list in
                  Settings → API usage or the Intel API.
                </p>
              </Card>
            </div>

            {/* Recent releases */}
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <TestTube2 size={15} className="text-amber-600" />
                <h3 className="font-semibold text-text-primary">Recent release reports</h3>
              </div>
              {data.releaseSeries.length === 0 ? (
                <p className="text-xs text-text-muted">No release reports yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {data.releaseSeries.slice(-10).reverse().map((r, i) => (
                    <div key={i} className="flex items-center justify-between text-xs text-text-secondary">
                      <span className="font-mono truncate">{r.requirementId.slice(0, 12)}</span>
                      <span className="flex gap-2 shrink-0">
                        <Badge tone={r.confidence >= 80 ? "green" : r.confidence >= 55 ? "amber" : "red"}>
                          {r.confidence}% conf
                        </Badge>
                        <span className="text-text-muted">cov {r.coveragePercent}%</span>
                        <span className="text-text-muted">pass {r.passRate}%</span>
                        <span className="text-text-muted">{r.date}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
