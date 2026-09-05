"use client";

import Link from "next/link";
import { useCallback, useRef, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Play, Loader2, Sparkles, Wand2, Square, AlertTriangle, RotateCcw, ShieldCheck, Workflow, History, CircleDot, FileText, TestTube2, Settings2, Info, ChevronDown, CheckCircle2, Pencil, Container, LayoutGrid } from "lucide-react";
import { Stepper, PIPELINE_STEPS } from "@/components/workspace/Stepper";
import { LiveLogs } from "@/components/workspace/LiveLogs";
import { AnalysisView } from "@/components/workspace/AnalysisView";
import { TestCasesEditor } from "@/components/workspace/TestCasesEditor";
import { ScriptView } from "@/components/workspace/ScriptView";
import { TestRunReport, type TestRunSnapshot } from "@/components/workspace/TestRunReport";
import { ReleaseGauge } from "@/components/workspace/ReleaseGauge";
import { TraceabilityRail } from "@/components/workspace/TraceabilityRail";
import { McpConnectionsCard } from "@/components/workspace/McpConnectionsCard";
import { TrainPipeline } from "@/components/workspace/TrainPipeline";
import { PipelineSummary } from "@/components/workspace/PipelineSummary";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageLoader } from "@/components/ui/PageLoader";
import { readNdjsonStream, cn } from "@/lib/utils";
import type {
  AgentEvent,
  Analysis,
  Coverage,
  Cycle,
  Defect,
  Evaluation,
  ReleaseReport,
  Requirement,
  Script,
} from "@/lib/types";

const SAMPLE = `Feature: User login with email and password

As a registered user, I want to log in with standard_user email and password so that we can access the account.

Acceptance Criteria:
- Login succeeds with valid email and password
- Invalid password shows "Invalid credentials" error
- Login button is disabled while submitting
- Password field supports show/hide toggle
- After 5 failed attempts, account is locked for 30 minutes
- "Forgot password" link navigates to reset flow
- Session expires after 60 minutes of inactivity`;

// Login flow for saucedemo app

// useSearchParams is consumed in this client component; the page module wraps
// it in a Suspense boundary (see page.tsx).

export function WorkspacePageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const workspaceId = searchParams.get("workspaceId") || "";

  // Auth guard: redirect to login if not signed in.
  const [authChecked, setAuthChecked] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const d = await res.json();
        if (!d.user) {
          router.replace("/login");
          return;
        }
      } catch {
        // fall through — allow offline/dev access
      } finally {
        setAuthChecked(true);
      }
    })();
  }, [router]);

  const [requirement, setRequirement] = useState<Requirement | null>(null);
  const [title, setTitle] = useState("Login flow for saucedemo app");
  const [content, setContent] = useState(SAMPLE);

  const [running, setRunning] = useState(false);
  const [connectOpen, setConnectOpen] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [doneSteps, setDoneSteps] = useState<Set<string>>(new Set());
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [currentAgent, setCurrentAgent] = useState<{ code: string; name: string; index: number; total: number } | null>(null);
  // Agent that failed (if any) — drives the "Retry from this agent" banner.
  const [failedAgent, setFailedAgent] = useState<{ code: string; name: string; index: number; total: number; message: string } | null>(null);

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [script, setScript] = useState<Script | null>(null);
  const [testRun, setTestRun] = useState<TestRunSnapshot | null>(null);
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [release, setRelease] = useState<ReleaseReport | null>(null);
  // DeepEval-style stage evaluations, keyed by stage (analyze/coverage/automate/execute/release).
  const [evaluations, setEvaluations] = useState<Record<string, Evaluation>>({});
  // Stage currently being judged by the DeepEval judge (drives the indicator).
  const [evaluating, setEvaluating] = useState<{ stage: string; agentCode: string } | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const agentSectionRef = useRef<HTMLDivElement | null>(null);
  // Last requirement metadata, so "Retry from failed agent" can resume with
  // the same requirement without re-collecting the form.
  const reqRef = useRef<{ id: string; title: string; source: string; sourceKey?: string; content: string } | null>(null);

  // Paused at the AS→EX boundary: the suite is generated and we're waiting for
  // the user to decide whether to run it on Docker before EX/DO execute.
  const [awaitingTestRun, setAwaitingTestRun] = useState(false);
  const [dockerAvailable, setDockerAvailable] = useState(false);
  // runId of the paused run — the resume must reuse it so history stays one row.
  const pausedRunIdRef = useRef<string | null>(null);
  // True while the Docker run itself is executing (from the consent card).
  const [runningTests, setRunningTests] = useState(false);

  // Probe whether this server can run Docker (local dev only; false on Vercel).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/docker-status");
        const d = await res.json();
        if (!cancelled) setDockerAvailable(Boolean(d.available));
      } catch {
        // best effort — assume no Docker
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // The workspace's latest (already-completed) requirement, if any. When it
  // exists the intake fields are shown greyed out with re-run / edit options.
  const [completedReq, setCompletedReq] = useState<{ id: string; title: string; content: string; createdAt: string } | null>(null);
  const [editingExisting, setEditingExisting] = useState(false);

  // On mount: load the latest requirement + its artifacts for this workspace so
  // returning users see their previous run instead of a blank sample.
  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/artifacts?workspaceId=${encodeURIComponent(workspaceId)}`);
        const data = await res.json();
        if (cancelled) return;
        const reqs = (data.requirement || []) as Requirement[];
        if (reqs.length) {
          const latest = reqs[reqs.length - 1];
          setRequirement(latest);
          setTitle(latest.title);
          setContent(latest.content);
          setCompletedReq({ id: latest.id, title: latest.title, content: latest.content, createdAt: latest.createdAt });
        }
        // Hydrate artifacts for the latest requirement.
        const rid = reqs.length ? reqs[reqs.length - 1].id : "";
        if (rid) {
          const as = (data.analysis || []).filter((a: { requirementId?: string }) => a.requirementId === rid);
          if (as.length) setAnalysis(as[as.length - 1]);
          const covs = (data.coverage || []).filter((c: { requirementId?: string }) => c.requirementId === rid);
          if (covs.length) setCoverage(covs[covs.length - 1]);
          const scr = (data.script || []).filter((s: { requirementId?: string }) => s.requirementId === rid);
          if (scr.length) setScript(scr[scr.length - 1]);
          const cyc = (data.cycle || []).filter((c: { requirementId?: string }) => c.requirementId === rid);
          if (cyc.length) setCycle(cyc[cyc.length - 1]);
          const defs = (data.defect || []).filter((d: { requirementId?: string }) => d.requirementId === rid);
          if (defs.length) setDefects(defs);
          const rels = (data.release || []).filter((r: { requirementId?: string }) => r.requirementId === rid);
          if (rels.length) setRelease(rels[rels.length - 1]);
          const evs = (data.evaluation || []).filter((e: { requirementId?: string }) => e.requirementId === rid);
          if (evs.length) setEvaluations(Object.fromEntries(evs.map((e: Evaluation) => [e.stage, e])));
        }
      } catch {
        // best effort
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const refreshArtifacts = useCallback(async () => {
    const rid = requirement?.id;
    if (!rid) return;
    try {
      const res = await fetch(`/api/artifacts?requirementId=${rid}&workspaceId=${encodeURIComponent(workspaceId)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.analysis?.length) setAnalysis(data.analysis[data.analysis.length - 1]);
      if (data.coverage?.length) setCoverage(data.coverage[data.coverage.length - 1]);
      if (data.script?.length) setScript(data.script[data.script.length - 1]);
      if (data.cycle?.length) setCycle(data.cycle[data.cycle.length - 1]);
      if (data.defect?.length) setDefects(data.defect);
      if (data.release?.length) setRelease(data.release[data.release.length - 1]);
      if (data.evaluation?.length) {
        const evs = data.evaluation as Evaluation[];
        setEvaluations(Object.fromEntries(evs.map((e) => [e.stage, e])));
      }
    } catch {
      // best effort
    }
  }, [requirement?.id, workspaceId]);

  const saveCoverage = async (cov: Coverage) => {
    setCoverage(cov);
    if (!requirement) return;
    try {
      await fetch("/api/artifacts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "coverage", id: cov.id, payload: cov, workspaceId }),
      });
    } catch {
      // best effort
    }
  };

  // Build the requirement object the pipeline (or a single agent) runs on.
  const buildRequirement = (): Requirement => ({
    id: crypto.randomUUID(),
    title,
    source: "manual",
    sourceKey: undefined,
    content,
    createdAt: new Date().toISOString(),
  });

  // Shared NDJSON handler: appends events, advances the stepper as agents
  // finish, and refreshes artifacts as new ones appear.
  //
  // Events stream in fast (every tool call + result). Instead of a setState per
  // event (which re-renders the whole tree each time), we batch into a single
  // array update per microtask — coalescing dozens of events into one render.
  const eventsRef = useRef<AgentEvent[]>([]);
  const batchScheduled = useRef(false);
  const flushEvents = useCallback(() => {
    batchScheduled.current = false;
    setEvents(eventsRef.current);
  }, []);

  const handleAgentEvent = (ev: unknown, rid: string) => {
    const e = ev as AgentEvent | { type: "step"; agentId: string; step: string; done: boolean };
    eventsRef.current = [...eventsRef.current, e as AgentEvent];
    if (!batchScheduled.current) {
      batchScheduled.current = true;
      queueMicrotask(flushEvents);
    }

    if (e.type === "agent_start") {
      setCurrentAgent({ code: e.code, name: e.name, index: e.index, total: e.total });
      // A new agent started — clear any stale failed-agent retry banner.
      setFailedAgent(null);
    }
    if (e.type === "agent_done") {
      setCurrentAgent(null);
      setFailedAgent(null);
    }
    if (e.type === "error") {
      // Hard error — stop the pipeline and remember WHICH agent failed so the
      // user can retry from that agent instead of re-running the whole pipeline.
      setRunning(false);
      setCurrentAgent(null);
      abortRef.current?.abort();
      if (e.agentId && e.agentId !== "pipeline") {
        const errEv = e as AgentEvent & { code?: string; name?: string; index?: number; total?: number };
        setFailedAgent({
          code: errEv.code || "",
          name: errEv.name || e.agentId,
          index: errEv.index ?? 0,
          total: errEv.total ?? 0,
          message: e.message,
        });
      }
    }
    if (e.type === "step" && e.step && e.done) {
      setDoneSteps((prev) => new Set(prev).add(e.step));
      const idx = PIPELINE_STEPS.findIndex((s) => s.key === e.step);
      setCurrentStep(Math.max(1, idx + 1));
      void refreshArtifactsDebounced(rid);
    }
    if (e.type === "artifact" && e.artifact === "requirement") {
      void refreshArtifactsDebounced(rid);
    }
    if (e.type === "artifact" && (e.artifact === "analysis" || e.artifact === "coverage" || e.artifact === "script" || e.artifact === "release" || e.artifact === "cycle")) {
      void refreshArtifactsDebounced(rid);
    }
    if (e.type === "test_run") {
      setTestRun({
        ok: e.ok,
        passed: e.passed,
        failed: e.failed,
        skipped: e.skipped,
        total: e.total,
        attempts: e.attempts,
        failures: e.failures,
        logs: e.logs,
        message: e.message,
      });
    }
    if (e.type === "evaluation") {
      setEvaluating(null);
      void refreshArtifactsDebounced(rid);
    }
    if (e.type === "eval_start") {
      const code = e.agentId.split("-").map((p) => p[0]?.toUpperCase() || "").join("");
      setEvaluating({ stage: e.stage, agentCode: code });
    }
    if (e.type === "awaiting_test_run") {
      // AS finished and the suite is ready — pause so the user can choose to
      // run it on Docker before EX/DO execute. Store the runId for the resume.
      pausedRunIdRef.current = e.runId || null;
      setAwaitingTestRun(true);
      // Stop the running spinner; the pipeline request ended (we resume after).
      setRunning(false);
      setCurrentAgent(null);
    }
  };

  // ONE-CLICK: run the full 6-agent chain.
  const handleRunPipeline = async (existingId?: string) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setEvents([]);
    eventsRef.current = [];
    setDoneSteps(new Set());
    setCurrentStep(0);
    setCurrentAgent(null);
    setFailedAgent(null);
    setAwaitingTestRun(false);
    setRunningTests(false);
    pausedRunIdRef.current = null;
    setAnalysis(null);
    setCoverage(null);
    setScript(null);
    setTestRun(null);
    setCycle(null);
    setDefects([]);
    setRelease(null);
    setEvaluations({});
    setEvaluating(null);
    // Collapse the intake card so the live pipeline view is front and center.
    setConnectOpen(false);

    // Re-running an existing requirement reuses its id so all new artifacts
    // stay linked to the same traceability root; otherwise create a fresh one.
    const req = existingId
      ? { ...buildRequirement(), id: existingId }
      : buildRequirement();
    setRequirement(req);
    reqRef.current = { id: req.id, title: req.title, source: req.source, sourceKey: undefined, content: req.content };

    // Scroll to the live agent section so the user sees the pipeline started.
    requestAnimationFrame(() => {
      agentSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requirementId: req.id,
          title: req.title,
          source: "manual",
          sourceKey: undefined,
          content: req.content,
          workspaceId,
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`Pipeline failed: ${res.status}`);
      await readNdjsonStream(res, (ev) => handleAgentEvent(ev, req.id), controller.signal);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setEvents((prev) => [
          ...prev,
          { type: "error", agentId: "pipeline", message: String(err) },
        ]);
      }
    } finally {
      setRunning(false);
      await refreshArtifactsWith(req.id);
    }
  };

  /**
   * Resume from the agent that failed: re-run that agent, then automatically
   * continue the remaining agents (the orchestrator's `startFrom` skips the
   * earlier agents). Uses the same requirement as the last run.
   *
   * `resumeOpts.runId` keeps the same history row when continuing a paused
   * run; `resumeOpts.testResults` injects real Docker results into EX/DO.
   */
  const resumePipeline = async (fromIndex?: number, resumeOpts?: { runId?: string; testResults?: string }) => {
    if (!reqRef.current) return;
    // Default: resume from the failed agent, else the first incomplete stage.
    const startFrom =
      fromIndex ??
      (failedAgent ? Math.max(0, failedAgent.index) : firstIncompleteStage());
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setAwaitingTestRun(false);
    setCurrentAgent(null);
    setFailedAgent(null);

    const req = reqRef.current;
    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requirementId: req.id,
          title: req.title,
          source: req.source,
          sourceKey: undefined,
          content: req.content,
          startFrom,
          workspaceId,
          runId: resumeOpts?.runId || pausedRunIdRef.current || undefined,
          testResults: resumeOpts?.testResults,
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`Resume failed: ${res.status}`);
      await readNdjsonStream(res, (ev) => handleAgentEvent(ev, req.id), controller.signal);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setEvents((prev) => [
          ...prev,
          { type: "error", agentId: "pipeline", message: String(err) },
        ]);
      }
    } finally {
      setRunning(false);
      await refreshArtifactsWith(req.id);
    }
  };

  /**
   * Consent-card actions: "Run on Docker" runs the generated suite via
   * /api/run (streaming), then resumes the pipeline at EX with the real
   * results so EX/DO record actual executions. "Skip" resumes at EX with no
   * results → EX/DO honestly report "not executed".
   */
  const runTestsThenResume = async (skip: boolean) => {
    const req = reqRef.current;
    if (!req) return;
    const EX_INDEX = 3; // execution-defect
    if (skip) {
      await resumePipeline(EX_INDEX, { runId: pausedRunIdRef.current || undefined });
      return;
    }
    setRunningTests(true);
    try {
      const controller = new AbortController();
      abortRef.current = controller;
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirementId: req.id, workspaceId }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`Test run failed: ${res.status}`);

      // Consume the NDJSON stream; the "result" event carries the summary.
      type RunOutcome = { passed: number; failed: number; skipped: number; total: number; exitCode: number | null; ok: boolean };
      let outcome: RunOutcome | null = null;
      await readNdjsonStream(res, (ev) => {
        const e = ev as { type?: string; summary?: { passed: number; failed: number; skipped: number; total: number }; exitCode?: number | null; ok?: boolean; message?: string };
        if (e.type === "result" && e.summary) {
          outcome = {
            passed: e.summary.passed,
            failed: e.summary.failed,
            skipped: e.summary.skipped,
            total: e.summary.total,
            exitCode: e.exitCode ?? null,
            ok: Boolean(e.ok),
          };
        }
        if (e.type === "status" || e.type === "log" || e.type === "error") {
          // Surface the raw docker log lines into the event feed so the
          // user sees the run happening (kept minimal — full logs in the
          // test-run report).
          setEvents((prev) => [
            ...prev,
            { type: "status", agentId: "pipeline", message: String(e.message || e.type).slice(0, 300) } as AgentEvent,
          ]);
        }
      }, controller.signal).catch(() => {});

      const summary = outcome as RunOutcome | null;

      if (summary) {
        const text = [
          `Automated test run (local Docker): ${summary.passed} passed, ${summary.failed} failed, ${summary.skipped} skipped (${summary.total} total), exit code ${summary.exitCode ?? "n/a"}.`,
          summary.failed > 0 ? "There were real failures — record them and raise defects for each failed case." : "All tests passed — record the executions on the cycle.",
        ].join("\n");
        setTestRun({
          ok: summary.ok,
          passed: summary.passed,
          failed: summary.failed,
          skipped: summary.skipped,
          total: summary.total,
          attempts: 1,
          failures: [],
          message: summary.ok ? "Tests passed on Docker." : "Tests failed on Docker — EX will record the failures.",
        });
        await resumePipeline(EX_INDEX, { runId: pausedRunIdRef.current || undefined, testResults: text });
      } else {
        await resumePipeline(EX_INDEX, { runId: pausedRunIdRef.current || undefined });
      }
    } catch (err) {
      setEvents((prev) => [
        ...prev,
        { type: "error", agentId: "pipeline", message: `Docker run failed: ${err instanceof Error ? err.message : String(err)}` } as AgentEvent,
      ]);
    } finally {
      setRunningTests(false);
    }
  };

  // Index of the first pipeline stage (0-5) whose agent has NOT completed,
  // derived from the event stream. Returns 0 when nothing has run yet.
  const firstIncompleteStage = () => {
    const doneAgentIds = new Set<string>();
    for (const e of events) {
      if (e.type === "agent_done") doneAgentIds.add(e.agentId);
    }
    const order = ["requirement-intelligence", "manual-test-case", "automation-script", "execution-defect", "devops-execution", "quality-intelligence"];
    const idx = order.findIndex((id) => !doneAgentIds.has(id));
    return idx === -1 ? 0 : idx;
  };

  // "Resume from stage" control state.
  const [resumeOpen, setResumeOpen] = useState(false);
  const [resumeFrom, setResumeFrom] = useState<number>(0);

  const refreshArtifactsWith = useCallback(
    async (rid: string) => {
      try {
        const res = await fetch(`/api/artifacts?requirementId=${rid}&workspaceId=${encodeURIComponent(workspaceId)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.analysis?.length) setAnalysis(data.analysis[data.analysis.length - 1]);
        if (data.coverage?.length) setCoverage(data.coverage[data.coverage.length - 1]);
        if (data.script?.length) setScript(data.script[data.script.length - 1]);
        if (data.cycle?.length) setCycle(data.cycle[data.cycle.length - 1]);
        if (data.defect?.length) setDefects(data.defect);
        if (data.release?.length) setRelease(data.release[data.release.length - 1]);
        if (data.evaluation?.length) {
          const evs = data.evaluation as Evaluation[];
          setEvaluations(Object.fromEntries(evs.map((e) => [e.stage, e])));
        }
      } catch {
        // best effort
      }
    },
    [workspaceId]
  );

  // Debounced variant for live events — coalesces rapid artifact events into
  // one refresh instead of one network call + 8 setStates per event.
  const debouncedRefresh = useRef<{ timer: ReturnType<typeof setTimeout> | null; rid: string }>({ timer: null, rid: "" });
  const refreshArtifactsDebounced = useCallback(
    (rid: string) => {
      const d = debouncedRefresh.current;
      d.rid = rid;
      if (d.timer) clearTimeout(d.timer);
      d.timer = setTimeout(() => {
        d.timer = null;
        void refreshArtifactsWith(d.rid);
      }, 400);
    },
    [refreshArtifactsWith]
  );

  const stopPipeline = () => {
    abortRef.current?.abort();
    setRunning(false);
    setCurrentAgent(null);
    setEvaluating(null);
    // Mark the run as stopped so the UI doesn't look like it's still going.
    setEvents((prev) => [
      ...prev,
      { type: "status", agentId: "pipeline", message: "Pipeline stopped by user." },
    ]);
  };

  if (!authChecked) {
    return <PageLoader label="Loading workspace…" />;
  }

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-border bg-bg-page/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-6 h-[64px] flex items-center gap-4">
          <Link href="/workspaces" className="flex items-center gap-2 font-bold text-text-primary">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500 text-white">
              <Sparkles size={15} />
            </span>
            QAE2E
          </Link>
          <span className="text-sm text-text-muted hidden md:inline">Quality workspace</span>
          <div className="ml-auto flex items-center gap-1.5">
            <Link
              href="/workspaces"
              className="inline-flex items-center gap-1.5 min-h-8 px-3 rounded-lg bg-amber-500 text-white text-xs font-semibold shadow-sm hover:bg-amber-600 transition-colors"
            >
              <LayoutGrid size={13} /> Workspaces
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 min-h-8 px-3 rounded-lg bg-amber-500 text-white text-xs font-semibold shadow-sm hover:bg-amber-600 transition-colors"
            >
              <Sparkles size={13} /> Home
            </Link>
            <Link
              href={`/history?workspaceId=${encodeURIComponent(workspaceId)}`}
              className="inline-flex items-center gap-1.5 min-h-8 px-3 rounded-lg bg-amber-500 text-white text-xs font-semibold shadow-sm hover:bg-amber-600 transition-colors"
            >
              <History size={13} /> History
            </Link>
            <Link
              href={`/settings?workspaceId=${encodeURIComponent(workspaceId)}&tab=integrations`}
              className="inline-flex items-center gap-1.5 min-h-8 px-3 rounded-lg bg-amber-500 text-white text-xs font-semibold shadow-sm hover:bg-amber-600 transition-colors"
            >
              <Settings2 size={13} /> Settings
            </Link>
            {running ? (
              <Button
                variant="secondary"
                onClick={stopPipeline}
                className="min-h-8 px-3 text-xs !border-red-500/50 !text-red-600 hover:!bg-red-500/10"
              >
                <Square size={13} /> Stop pipeline
              </Button>
            ) : (
              <Button onClick={() => handleRunPipeline()} className="min-h-8 px-3 text-xs">
                <Play size={13} /> Run pipeline
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <Stepper current={currentStep} done={doneSteps} />

        {/* How it works — a short flow explainer so the user knows what happens */}
        <div className="mt-6 rounded-2xl border border-amber-500/25 bg-gradient-to-br from-bg-surface to-bg-hover card-shadow p-6 md:p-8">
          <div className="flex items-center gap-2 mb-5">
            <Sparkles size={16} className="text-amber-600 shrink-0" />
            <div>
              <h2 className="text-lg font-bold text-text-primary leading-tight">How it works</h2>
              <p className="text-sm text-text-secondary">From requirement to release confidence — six specialist agents, one connected record.</p>
            </div>
          </div>

          {/* Horizontal flow steps (wrap on mobile) */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { icon: CircleDot, step: "1", title: "Connect", text: "Paste a requirement — the current workflow supports copy-pasted requirements only." },
              { icon: Workflow, step: "2", title: "Analyze", text: "RI extracts business rules, acceptance criteria, risks, and edge cases." },
              { icon: FileText, step: "3", title: "Coverage", text: "MT drafts editable manual test cases, grounded in existing ones." },
              { icon: TestTube2, step: "4", title: "Automate", text: "AS generates a Playwright POM suite server-side from your coverage." },
              { icon: ShieldCheck, step: "5", title: "Release", text: "EX/DO run the tests, raise defects, and IQ reports release confidence." },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="rounded-xl border border-border bg-bg-page p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500/10 text-amber-700">
                      <Icon size={14} />
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-wide text-text-muted">Step {f.step}</span>
                  </div>
                  <p className="text-sm font-semibold text-text-primary">{f.title}</p>
                  <p className="text-xs text-text-secondary leading-relaxed">{f.text}</p>
                </div>
              );
            })}
          </div>

          {/* One-line pointer to the action */}
          <p className="mt-5 text-sm text-text-secondary">
            Your requirement is already pre-filled with a sample — just click{" "}
            <span className="font-semibold text-amber-700">Run pipeline</span> in the top bar to watch the six
            agents work, or paste your own requirement below.
          </p>
        </div>

        <div className="mt-8 grid lg:grid-cols-[1fr_300px] gap-6">
          {/* Left column */}
          <div className="space-y-6 min-w-0">
            {/* Step 01 — Connect */}
            <Card className="p-6">
              <button
                onClick={() => setConnectOpen((o) => !o)}
                className="w-full flex items-center gap-2"
                type="button"
              >
                <Wand2 size={16} className="text-amber-600" />
                <h2 className="font-semibold text-text-primary">1 · Connect your source</h2>
                {!connectOpen && (
                  <span className="ml-auto text-xs text-text-muted flex items-center gap-1.5">
                    {running ? "Pipeline running — watching live logs below" : "Collapsed"}
                    <ChevronDown size={14} className="transition-transform" />
                  </span>
                )}
                {connectOpen && <ChevronDown size={14} className="ml-auto text-text-muted rotate-180" />}
              </button>

              {connectOpen && (
                <>
                  {/* Copy-paste-only notice */}
                  <div className="flex items-center gap-3 px-4 py-3 mt-4 mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10">
                    <Info size={16} className="text-amber-600 shrink-0" />
                    <p className="text-sm text-text-primary">
                      Currently supporting <span className="font-bold text-amber-700">copy-pasted requirements</span> only —
                      MCP connections (Jira / Confluence / GitHub / Zephyr / TestRail / Pinecone) are coming soon.
                    </p>
                  </div>

                  {completedReq && !editingExisting && (
                    <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 text-xs font-bold">
                          <CheckCircle2 size={12} /> Completed
                        </span>
                        <span className="text-xs text-text-muted">
                          {new Date(completedReq.createdAt).toLocaleString()} · re-run it as-is or edit it first
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button onClick={() => handleRunPipeline(completedReq.id)} disabled={running}>
                          <RotateCcw size={14} /> Re-run existing requirement
                        </Button>
                        <Button variant="secondary" onClick={() => setEditingExisting(true)} disabled={running}>
                          <Pencil size={14} /> Edit requirement
                        </Button>
                      </div>
                    </div>
                  )}

                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Requirement title"
                    disabled={Boolean(completedReq && !editingExisting)}
                    className={cn(
                      "rounded-lg border border-border-input bg-bg-input px-3.5 py-2.5 text-sm focus:outline-none focus:border-amber-500",
                      completedReq && !editingExisting && "opacity-50 bg-bg-surface cursor-not-allowed select-none"
                    )}
                  />
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={10}
                    placeholder="Paste the requirement text…"
                    disabled={Boolean(completedReq && !editingExisting)}
                    className={cn(
                      "mt-3 w-full rounded-lg border border-border-input bg-bg-input px-3.5 py-3 text-sm leading-relaxed focus:outline-none focus:border-amber-500 font-mono",
                      completedReq && !editingExisting && "opacity-50 bg-bg-surface cursor-not-allowed select-none"
                    )}
                  />
                </>
              )}
            </Card>

            {/* Status banner — running agent OR AI evaluation judging (never both) */}
            <div ref={agentSectionRef} className="scroll-mt-24 space-y-3">
            {evaluating ? (
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <p className="text-sm text-text-primary flex-1 min-w-0">
                  <span className="font-bold text-emerald-700">AI Evaluation</span> — checking the{" "}
                  <span className="font-semibold capitalize">{evaluating.stage}</span> output ({evaluating.agentCode})
                  against the requirement…
                </p>
              </div>
            ) : (running || currentAgent) ? (
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-amber-500/40 bg-amber-500/10">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                <p className="text-sm text-text-primary flex-1 min-w-0">
                  {currentAgent ? (
                    <>
                      <span className="font-bold text-amber-700">
                        Agent {currentAgent.index + 1}/{currentAgent.total}: {currentAgent.code}
                      </span>{" "}
                      — {currentAgent.name} running…
                    </>
                  ) : (
                    <span className="font-bold text-amber-700">Pipeline starting…</span>
                  )}
                </p>
                {running && (
                  <button
                    onClick={stopPipeline}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-red-500/40 bg-red-500/10 text-red-700 text-xs font-semibold hover:bg-red-500/15"
                  >
                    <Square size={12} /> Stop
                  </button>
                )}
              </div>
            ) : null}
            </div>

            {/* Docker consent card — pipeline paused after AS, before EX */}
            {awaitingTestRun && !running && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-5">
                <div className="flex items-center gap-2">
                  <Container size={16} className="text-amber-600 shrink-0" />
                  <h3 className="font-semibold text-text-primary">Run the generated Playwright suite?</h3>
                </div>
                <p className="mt-2 text-sm text-text-secondary leading-relaxed">
                  The automation suite is ready. Running it on Docker gives the Execution &amp; DevOps agents real
                  pass/fail results to record, so the AI judge can score actual test executions. Skipping makes them
                  honestly report <span className="font-semibold text-text-primary">"not executed"</span>.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {dockerAvailable ? (
                    <button
                      onClick={() => void runTestsThenResume(false)}
                      disabled={runningTests}
                      className="inline-flex items-center gap-1.5 min-h-9 px-4 rounded-lg bg-amber-500 text-white text-sm font-semibold shadow-sm hover:bg-amber-600 disabled:opacity-60"
                    >
                      {runningTests ? <Loader2 size={14} className="animate-spin" /> : <Container size={14} />}
                      {runningTests ? "Running tests on Docker…" : "Run on Docker"}
                    </button>
                  ) : (
                    <p className="text-xs text-text-muted w-full">
                      Docker isn't available on this server (Vercel has no Docker) — the suite can't be auto-run here.
                    </p>
                  )}
                  <button
                    onClick={() => void runTestsThenResume(true)}
                    disabled={runningTests}
                    className="inline-flex items-center gap-1.5 min-h-9 px-4 rounded-lg border border-border bg-bg-surface text-text-secondary text-sm font-semibold hover:bg-bg-hover disabled:opacity-60"
                  >
                    Skip — report as not executed
                  </button>
                </div>
              </div>
            )}

            {/* Retry banner — shown after an agent failed */}
            {failedAgent && !running && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-red-500/40 bg-red-500/10">
                <AlertTriangle size={16} className="text-red-600 shrink-0" />
                <p className="text-sm text-text-primary flex-1 min-w-0">
                  <span className="font-bold text-red-700">
                    {failedAgent.code ? `Agent ${failedAgent.index + 1}/${failedAgent.total || 6}: ${failedAgent.code}` : failedAgent.name}
                  </span>{" "}
                  failed — {failedAgent.message}
                </p>
                <button
                  onClick={() => resumePipeline()}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600"
                >
                  <RotateCcw size={13} /> Retry from {failedAgent.code || "this agent"}
                </button>
              </div>
            )}

            {/* Resume pipeline from stage — only when the run is genuinely
                incomplete (not all 6 agents reached). A fully completed run
                doesn't need a resume control. */}
            {!running &&
              !awaitingTestRun &&
              reqRef.current &&
              events.length > 0 &&
              (() => {
                const done = new Set<string>();
                for (const e of events) if (e.type === "agent_done") done.add(e.agentId);
                const order = ["requirement-intelligence", "manual-test-case", "automation-script", "execution-defect", "devops-execution", "quality-intelligence"];
                const allDone = order.every((id) => done.has(id));
                return !allDone;
              })() && (
              <Card className="p-4">
                <button
                  onClick={() => setResumeOpen((o) => !o)}
                  className="w-full flex items-center gap-2"
                  type="button"
                >
                  <Play size={15} className="text-amber-600" />
                  <span className="text-sm font-semibold text-text-primary">Resume pipeline from a stage</span>
                  <ChevronDown size={14} className={`ml-auto text-text-muted transition-transform ${resumeOpen ? "rotate-180" : ""}`} />
                </button>
                {resumeOpen && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <select
                      value={resumeFrom}
                      onChange={(e) => setResumeFrom(Number(e.target.value))}
                      className="rounded-lg border border-border-input bg-bg-input px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                    >
                      {["Requirement Intelligence (RI)", "Manual Test Cases (MT)", "Automation Scripts (AS)", "Execution & Defects (EX)", "DevOps Execution (DO)", "Release Report (IQ)"].map((label, i) => (
                        <option key={i} value={i}>
                          {i + 1}. {label}
                        </option>
                      ))}
                    </select>
                    <Button onClick={() => resumePipeline(resumeFrom)}>
                      <RotateCcw size={14} /> Resume from stage {resumeFrom + 1}
                    </Button>
                  </div>
                )}
              </Card>
            )}

            {/* Agent pipeline train — stations + click-to-expand agent outputs */}
            <TrainPipeline events={events} evaluations={evaluations} running={running} evaluating={evaluating} />

            {/* Run summary — shown after a run completes */}
            {!running && events.length > 0 && <PipelineSummary events={events} />}

            {/* Step artifacts */}
            {analysis && <AnalysisView analysis={analysis} evaluation={evaluations.analyze} />}
            {coverage && <TestCasesEditor coverage={coverage} onEdit={saveCoverage} evaluation={evaluations.coverage} />}
            <ScriptView script={script} waiting={Boolean(coverage && !script)} evaluation={evaluations.automate} />
            <TestRunReport run={testRun} evaluation={evaluations.execute} />
            {release && (
              <Card className="p-6">
                <h3 className="font-semibold text-text-primary mb-3">Release report</h3>
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
            <McpConnectionsCard />
            {/* Live logs — everything happening in the run, in a scrolling feed */}
            <LiveLogs events={events} running={running} />
            <ReleaseGauge report={release} evaluation={evaluations.release} />
            <TraceabilityRail
              requirement={requirement}
              analysis={analysis}
              coverage={coverage}
              script={script}
              cycle={cycle}
              defects={defects}
              release={release}
              running={running}
              currentAgentCode={currentAgent?.code ?? null}
              doneSteps={doneSteps}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
