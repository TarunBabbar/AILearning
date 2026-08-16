"use client";

// Run detail — full artifact view of a single pipeline run: requirement,
// analysis, test coverage, automation scripts, test-run report, release report
// + confidence gauge, plus AI evaluation scores for every stage.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { PageLoader } from "@/components/ui/PageLoader";
import { AppFooter } from "@/components/ui/AppFooter";
import { AnalysisView } from "@/components/workspace/AnalysisView";
import { TestCasesEditor } from "@/components/workspace/TestCasesEditor";
import { ScriptView } from "@/components/workspace/ScriptView";
import { TestRunReport, type TestRunSnapshot } from "@/components/workspace/TestRunReport";
import { ReleaseGauge } from "@/components/workspace/ReleaseGauge";
import { TraceabilityRail } from "@/components/workspace/TraceabilityRail";
import { EvaluationCard } from "@/components/workspace/EvaluationCard";
import { ArrowLeft, History, FileText, ListChecks, FileCode2, Container, Rocket, Scale } from "lucide-react";
import type {
  Analysis,
  Coverage,
  Cycle,
  Defect,
  Evaluation,
  ReleaseReport,
  Requirement,
  Script,
} from "@/lib/types";

interface RunDetail {
  id: string;
  title: string;
  requirementId: string;
  status: string;
  startedAt: string;
  finishedAt: string;
  evaluations?: Array<{ agentCode: string; stage: string; precision: number; accuracy: number }>;
  testRun?: { ok: boolean; passed: number; failed: number; skipped: number; total: number; attempts: number; failures?: Array<{ test: string; message: string }>; logs?: string[]; message?: string };
  counts: { analyses: number; coverages: number; testCases: number; scripts: number; cycles: number; defects: number; releases: number; evaluations: number };
}

export function RunDetailPageInner({ id }: { id: string }) {
  const sp = useSearchParams();
  const workspaceId = sp.get("workspaceId") || "";

  const [run, setRun] = useState<RunDetail | null>(null);
  const [req, setReq] = useState<Requirement | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [script, setScript] = useState<Script | null>(null);
  const [testRun, setTestRun] = useState<TestRunSnapshot | null>(null);
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [release, setRelease] = useState<ReleaseReport | null>(null);
  const [evaluations, setEvaluations] = useState<Record<string, Evaluation>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!id) {
      setLoading(false);
      setError("Missing run id in the URL.");
      return;
    }
    const timer = setTimeout(() => {
      if (!cancelled) {
        setLoading(false);
        setError("Timed out loading the run — try again.");
      }
    }, 20000);
    (async () => {
      try {
        // Fetch run metadata + all workspace artifacts in parallel (the
        // artifacts route returns everything for the workspace; we filter to
        // this run's requirementId client-side). Faster than a waterfall.
        const [runRes, artRes] = await Promise.all([
          fetch(`/api/runs?id=${encodeURIComponent(id)}&workspaceId=${encodeURIComponent(workspaceId)}`),
          fetch(`/api/artifacts?workspaceId=${encodeURIComponent(workspaceId)}`),
        ]);
        const d = await runRes.json();
        if (cancelled) return;
        if (!runRes.ok || !d.run) {
          setError(d.error || "Run not found");
          return;
        }
        const r = d.run as RunDetail;
        setRun(r);

        const ad = artRes.ok ? await artRes.json() : {};
        if (cancelled) return;
        if (r.requirementId) {
          const pick = <T extends { id?: string; requirementId?: string }>(arr: T[] | undefined): T[] =>
            (arr || []).filter((x) => x.requirementId === r.requirementId || x.id === r.requirementId);
          const reqs = pick<Requirement>(ad.requirement);
          if (reqs.length) setReq(reqs[reqs.length - 1]);
          const as = pick<Analysis>(ad.analysis);
          if (as.length) setAnalysis(as[as.length - 1]);
          const covs = pick<Coverage>(ad.coverage);
          if (covs.length) setCoverage(covs[covs.length - 1]);
          const scr = pick<Script>(ad.script);
          if (scr.length) setScript(scr[scr.length - 1]);
          const cyc = pick<Cycle>(ad.cycle);
          if (cyc.length) setCycle(cyc[cyc.length - 1]);
          const defs = pick<Defect>(ad.defect);
          if (defs.length) setDefects(defs);
          const rels = pick<ReleaseReport>(ad.release);
          if (rels.length) setRelease(rels[rels.length - 1]);
          const evs = pick<Evaluation>(ad.evaluation);
          if (evs.length) setEvaluations(Object.fromEntries(evs.map((e) => [e.stage, e])));
        }
        if (r.testRun) {
          setTestRun({
            ok: r.testRun.ok,
            passed: r.testRun.passed,
            failed: r.testRun.failed,
            skipped: r.testRun.skipped,
            total: r.testRun.total,
            attempts: r.testRun.attempts,
            failures: r.testRun.failures,
            logs: r.testRun.logs,
            message: r.testRun.message,
          });
        }
      } catch {
        if (!cancelled) setError("Failed to load run");
      } finally {
        if (!cancelled) setLoading(false);
        clearTimeout(timer);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id, workspaceId]);

  if (loading) {
    return <PageLoader label="Loading run…" />;
  }

  if (error || !run) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-red-600">
        {error || "Run not found"}
      </div>
    );
  }

  const stageOrder: Array<{ key: string; label: string; agent: string }> = [
    { key: "analyze", label: "Requirement Intelligence", agent: "RI" },
    { key: "coverage", label: "Manual Test Coverage", agent: "MT" },
    { key: "automate", label: "Automation Scripts", agent: "AS" },
    { key: "execute", label: "Test Execution", agent: "EX" },
    { key: "release", label: "Release Report", agent: "IQ" },
  ];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-border bg-bg-page/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-6 h-[64px] flex items-center gap-4">
          <Link href="/workspaces" className="flex items-center gap-2 font-bold text-text-primary">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500 text-white">
              <History size={15} />
            </span>
            QAE2E
          </Link>
          <span className="text-sm text-text-muted hidden md:inline">Run detail</span>
          <Link
            href={`/history?workspaceId=${encodeURIComponent(workspaceId)}`}
            className="ml-auto inline-flex items-center gap-1.5 min-h-9 px-4 rounded-lg border border-border text-text-secondary text-sm font-semibold hover:bg-bg-hover transition-colors"
          >
            <ArrowLeft size={14} /> Back to history
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Run header */}
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">{run.title}</h1>
            <p className="mt-1 text-sm text-text-secondary">
              {new Date(run.startedAt).toLocaleString()} · {run.status}
              {run.counts.testCases ? ` · ${run.counts.testCases} cases` : ""}
              {run.counts.scripts ? ` · ${run.counts.scripts} scripts` : ""}
              {run.counts.defects ? ` · ${run.counts.defects} defects` : ""}
            </p>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            {stageOrder.map((s) => {
              const ev = evaluations[s.key];
              if (!ev) return null;
              return (
                <span key={s.key} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 text-xs font-bold" title={ev.rationale}>
                  <Scale size={12} /> {s.agent} P{ev.precision} · A{ev.accuracy}
                </span>
              );
            })}
          </div>
        </div>

        <div className="mt-8 grid lg:grid-cols-[1fr_300px] gap-6">
          {/* Left column — full artifact view */}
          <div className="space-y-6 min-w-0">
            {/* AI Evaluation summary table */}
            {Object.keys(evaluations).length > 0 && (
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Scale size={16} className="text-emerald-600" />
                  <h3 className="font-semibold text-text-primary">AI Evaluation — requirement → release mapping</h3>
                </div>
                <div className="space-y-3">
                  {stageOrder.map((s) => {
                    const ev = evaluations[s.key];
                    if (!ev) return null;
                    return (
                      <EvaluationCard
                        key={s.key}
                        stageLabel={s.label}
                        precision={ev.precision}
                        accuracy={ev.accuracy}
                        rationale={ev.rationale}
                        overall={ev.overall}
                        improvements={ev.improvements}
                        verdict={ev.verdict}
                        metrics={ev.metrics}
                        perItem={ev.perItem}
                      />
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Requirement */}
            {req && (
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <FileText size={16} className="text-amber-600" />
                  <h3 className="font-semibold text-text-primary">Requirement</h3>
                </div>
                <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{req.content}</p>
              </Card>
            )}

            {/* Analysis */}
            {analysis && <AnalysisView analysis={analysis} evaluation={evaluations.analyze} />}

            {/* Coverage */}
            {coverage && (
              <TestCasesEditor
                coverage={coverage}
                onEdit={() => {}}
                evaluation={evaluations.coverage}
              />
            )}

            {/* Scripts */}
            <ScriptView script={script} waiting={Boolean(coverage && !script)} evaluation={evaluations.automate} />

            {/* Test run */}
            {testRun && <TestRunReport run={testRun} evaluation={evaluations.execute} />}

            {/* Release report */}
            {release && (
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Rocket size={16} className="text-amber-600" />
                  <h3 className="font-semibold text-text-primary">Release report</h3>
                </div>
                <p className="text-sm text-text-secondary leading-relaxed">{release.summary}</p>
                <ul className="mt-4 space-y-1.5">
                  {release.findings.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs font-bold uppercase tracking-wide text-text-muted mb-2">Recommendations</p>
                  <ul className="space-y-1.5">
                    {release.recommendations.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" /> {r}
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            )}
          </div>

          {/* Right rail */}
          <div className="space-y-6">
            <ReleaseGauge report={release} evaluation={evaluations.release} />
            <TraceabilityRail
              requirement={req}
              analysis={analysis}
              coverage={coverage}
              script={script}
              cycle={cycle}
              defects={defects}
              release={release}
              running={false}
              currentAgentCode={null}
              doneSteps={new Set()}
            />
          </div>
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
