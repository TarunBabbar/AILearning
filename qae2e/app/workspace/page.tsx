"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { ArrowLeft, Play, Loader2, Sparkles, Wand2, GitBranch, ChevronDown, Square, AlertTriangle, RotateCcw } from "lucide-react";
import { Stepper, PIPELINE_STEPS } from "@/components/workspace/Stepper";
import { AgentStream } from "@/components/workspace/AgentStream";
import { AnalysisView } from "@/components/workspace/AnalysisView";
import { TestCasesEditor } from "@/components/workspace/TestCasesEditor";
import { ScriptView } from "@/components/workspace/ScriptView";
import { TestRunReport, type TestRunSnapshot } from "@/components/workspace/TestRunReport";
import { ReleaseGauge } from "@/components/workspace/ReleaseGauge";
import { TraceabilityRail } from "@/components/workspace/TraceabilityRail";
import { ConnectorsPanel } from "@/components/workspace/ConnectorsPanel";
import { GitHubCheckin } from "@/components/workspace/GitHubCheckin";
import { TestRunner } from "@/components/workspace/TestRunner";
import { PipelineSetup, type SetupValues } from "@/components/workspace/PipelineSetup";
import { PipelineSummary } from "@/components/workspace/PipelineSummary";
import { RunHistory } from "@/components/workspace/RunHistory";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { readNdjsonStream } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type {
  AgentEvent,
  Analysis,
  Coverage,
  Cycle,
  Defect,
  ReleaseReport,
  Requirement,
  Script,
} from "@/lib/types";

const SAMPLE = `Feature: User login with email and password

As a registered user, I want to log in with my email and password so that I can access my account.

Acceptance Criteria:
- Login succeeds with valid email and password
- Invalid password shows "Invalid credentials" error
- Login button is disabled while submitting
- Password field supports show/hide toggle
- After 5 failed attempts, account is locked for 30 minutes
- "Forgot password" link navigates to reset flow
- Session expires after 60 minutes of inactivity`;

export default function WorkspacePage() {
  const [requirement, setRequirement] = useState<Requirement | null>(null);
  const [title, setTitle] = useState("Login flow for web app");
  const [source, setSource] = useState("manual");
  const [sourceKey, setSourceKey] = useState("");
  const [content, setContent] = useState(SAMPLE);

  const [running, setRunning] = useState(false);
  const [fetchingSource, setFetchingSource] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [doneSteps, setDoneSteps] = useState<Set<string>>(new Set());
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [currentAgent, setCurrentAgent] = useState<{ code: string; name: string; index: number; total: number } | null>(null);
  // Agent that failed (if any) — drives the "Retry from this agent" banner.
  const [failedAgent, setFailedAgent] = useState<{ code: string; name: string; index: number; total: number; message: string } | null>(null);
  const [devOpsOpen, setDevOpsOpen] = useState(false);

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [script, setScript] = useState<Script | null>(null);
  const [testRun, setTestRun] = useState<TestRunSnapshot | null>(null);
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [release, setRelease] = useState<ReleaseReport | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const agentSectionRef = useRef<HTMLDivElement | null>(null);
  // Last intake values + requirement metadata, so "Retry from failed agent"
  // can resume with the same env overrides without re-collecting the form.
  const setupRef = useRef<SetupValues>({});
  const reqRef = useRef<{ id: string; title: string; source: string; sourceKey?: string; content: string } | null>(null);

  const refreshArtifacts = useCallback(async () => {
    const rid = requirement?.id;
    if (!rid) return;
    try {
      const res = await fetch(`/api/artifacts?requirementId=${rid}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.analysis?.length) setAnalysis(data.analysis[data.analysis.length - 1]);
      if (data.coverage?.length) setCoverage(data.coverage[data.coverage.length - 1]);
      if (data.script?.length) setScript(data.script[data.script.length - 1]);
      if (data.cycle?.length) setCycle(data.cycle[data.cycle.length - 1]);
      if (data.defect?.length) setDefects(data.defect);
      if (data.release?.length) setRelease(data.release[data.release.length - 1]);
    } catch {
      // best effort
    }
  }, [requirement?.id]);

  const saveCoverage = async (cov: Coverage) => {
    setCoverage(cov);
    if (!requirement) return;
    try {
      await fetch("/api/artifacts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "coverage", id: cov.id, payload: cov }),
      });
    } catch {
      // best effort
    }
  };

  const fetchFromSource = async () => {
    if (!sourceKey) return;
    setFetchingSource(true);
    setFetchError(null);
    try {
      if (source === "jira") {
        const res = await fetch("/api/connectors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "test", connector: "jira", fields: { issueKey: sourceKey } }),
        });
        const d = await res.json();
        // The test endpoint returns ok/detail only — fall back to a clear message.
        setFetchError(d.ok ? "Jira fetched — check the agent activity for content." : d.detail || "Jira fetch failed");
        setContent((c) => c); // content comes via the RI agent fetch tool in the pipeline
      } else if (source === "confluence") {
        setFetchError("Confluence fetch runs inside the pipeline (RI agent). Paste content or run the pipeline.");
      } else if (source === "figma") {
        setFetchError("Figma fetch runs inside the pipeline (RI agent). Paste content or run the pipeline.");
      } else {
        setFetchError("Manual/other source — paste the requirement text.");
      }
    } catch (err) {
      setFetchError(String(err));
    } finally {
      setFetchingSource(false);
    }
  };

  // Build the requirement object the pipeline (or a single agent) runs on.
  const buildRequirement = (): Requirement => ({
    id: crypto.randomUUID(),
    title,
    source: source as Requirement["source"],
    sourceKey: sourceKey || undefined,
    content,
    createdAt: new Date().toISOString(),
  });

  const sourceHint =
    source !== "manual" && sourceKey
      ? ` The requirement came from ${source} with key/id "${sourceKey}". If the content above was not already fetched, call the matching fetch tool (jira_fetch_issue / confluence_fetch_page / figma_fetch_file) to load it before analyzing.`
      : "";

  // Shared NDJSON handler: appends events, advances the stepper as agents
  // finish, and refreshes artifacts as new ones appear.
  const handleAgentEvent = (ev: unknown, rid: string) => {
    const e = ev as AgentEvent | { type: "step"; agentId: string; step: string; done: boolean };
    setEvents((prev) => [...prev, e as AgentEvent]);

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
      void refreshArtifactsWith(rid);
    }
    if (e.type === "artifact" && e.artifact === "requirement") {
      void refreshArtifactsWith(rid);
    }
    if (e.type === "artifact" && (e.artifact === "analysis" || e.artifact === "coverage" || e.artifact === "script" || e.artifact === "release" || e.artifact === "cycle")) {
      void refreshArtifactsWith(rid);
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
  };

  // ONE-CLICK: run the full 6-agent chain.
  const handleRunPipeline = async (setup?: SetupValues) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setEvents([]);
    setDoneSteps(new Set());
    setCurrentStep(0);
    setCurrentAgent(null);
    setFailedAgent(null);
    setAnalysis(null);
    setCoverage(null);
    setScript(null);
    setTestRun(null);
    setCycle(null);
    setDefects([]);
    setRelease(null);

    const req = buildRequirement();
    setRequirement(req);
    setupRef.current = setup || {};
    reqRef.current = { id: req.id, title: req.title, source: req.source, sourceKey: sourceKey || undefined, content: req.content + sourceHint };

    // Scroll to the live agent section so the user sees the pipeline started.
    requestAnimationFrame(() => {
      agentSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    try {
      const env: Record<string, string> = {};
      if (setup?.githubToken) env.GITHUB_TOKEN = setup.githubToken;
      if (setup?.githubOwner) env.GITHUB_OWNER = setup.githubOwner;
      if (setup?.githubRepo) env.GITHUB_REPO = setup.githubRepo;
      if (setup?.jiraProjectKey) env.JIRA_PROJECT_KEY = setup.jiraProjectKey;
      if (setup?.testrailRunId) env.TESTRAIL_RUN_ID = setup.testrailRunId;
      if (setup?.dockerImage) env.DOCKER_IMAGE = setup.dockerImage;
      if (setup?.sourceKey) {
        // Non-manual source key: hint RI to fetch from the connector.
        setSourceKey(setup.sourceKey);
      }

      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requirementId: req.id,
          title: req.title,
          source: req.source,
          sourceKey: setup?.sourceKey || req.sourceKey,
          content: req.content + sourceHint,
          env: Object.keys(env).length ? env : undefined,
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
   * earlier agents). Uses the same requirement + intake env as the last run.
   */
  const resumePipeline = async () => {
    if (!failedAgent || !reqRef.current) return;
    const startFrom = Math.max(0, failedAgent.index);
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setCurrentAgent(null);
    setFailedAgent(null);

    const setup = setupRef.current;
    const req = reqRef.current;
    try {
      const env: Record<string, string> = {};
      if (setup?.githubToken) env.GITHUB_TOKEN = setup.githubToken;
      if (setup?.githubOwner) env.GITHUB_OWNER = setup.githubOwner;
      if (setup?.githubRepo) env.GITHUB_REPO = setup.githubRepo;
      if (setup?.jiraProjectKey) env.JIRA_PROJECT_KEY = setup.jiraProjectKey;
      if (setup?.testrailRunId) env.TESTRAIL_RUN_ID = setup.testrailRunId;
      if (setup?.dockerImage) env.DOCKER_IMAGE = setup.dockerImage;

      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requirementId: req.id,
          title: req.title,
          source: req.source,
          sourceKey: setup?.sourceKey || req.sourceKey,
          content: req.content,
          startFrom,
          env: Object.keys(env).length ? env : undefined,
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

  const refreshArtifactsWith = async (rid: string) => {
    try {
      const res = await fetch(`/api/artifacts?requirementId=${rid}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.analysis?.length) setAnalysis(data.analysis[data.analysis.length - 1]);
      if (data.coverage?.length) setCoverage(data.coverage[data.coverage.length - 1]);
      if (data.script?.length) setScript(data.script[data.script.length - 1]);
      if (data.cycle?.length) setCycle(data.cycle[data.cycle.length - 1]);
      if (data.defect?.length) setDefects(data.defect);
      if (data.release?.length) setRelease(data.release[data.release.length - 1]);
    } catch {
      // best effort
    }
  };

  const stopPipeline = () => {
    abortRef.current?.abort();
    setRunning(false);
    setCurrentAgent(null);
    // Mark the run as stopped so the UI doesn't look like it's still going.
    setEvents((prev) => [
      ...prev,
      { type: "status", agentId: "pipeline", message: "Pipeline stopped by user." },
    ]);
  };

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-border bg-bg-page/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-6 h-[64px] flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 font-bold text-text-primary">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500 text-white">
              <Sparkles size={15} />
            </span>
            QAE2E
          </Link>
          <span className="text-sm text-text-muted hidden md:inline">Quality workspace</span>
          <div className="ml-auto flex items-center gap-2">
            {running ? (
              <Button
                variant="secondary"
                onClick={stopPipeline}
                className="min-h-9 px-4 !border-red-500/50 !text-red-600 hover:!bg-red-500/10"
              >
                <Square size={14} /> Stop pipeline
              </Button>
            ) : (
              <Button onClick={() => handleRunPipeline()} className="min-h-9 px-4">
                <Play size={14} /> Run pipeline
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <Stepper current={currentStep} done={doneSteps} />

        <div className="mt-8 grid lg:grid-cols-[1fr_300px] gap-6">
          {/* Left column */}
          <div className="space-y-6 min-w-0">
            {/* Step 01 — Connect */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Wand2 size={16} className="text-amber-600" />
                <h2 className="font-semibold text-text-primary">1 · Connect your source</h2>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Requirement title"
                  className="rounded-lg border border-border-input bg-bg-input px-3.5 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                />
                <div className="flex gap-3">
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className="rounded-lg border border-border-input bg-bg-input px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                  >
                    <option value="manual">Manual input</option>
                    <option value="jira">Jira</option>
                    <option value="confluence">Confluence</option>
                    <option value="figma">Figma</option>
                    <option value="other">Other</option>
                  </select>
                  <input
                    value={sourceKey}
                    onChange={(e) => setSourceKey(e.target.value)}
                    placeholder={source === "jira" ? "Jira issue key (QA-123)" : source === "confluence" ? "Page ID" : source === "figma" ? "Figma file key" : "Source key"}
                    className="flex-1 rounded-lg border border-border-input bg-bg-input px-3.5 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
              <div className="flex items-end gap-2">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={10}
                  placeholder="Paste the requirement text… (or click Fetch from source)"
                  className="mt-3 w-full rounded-lg border border-border-input bg-bg-input px-3.5 py-3 text-sm leading-relaxed focus:outline-none focus:border-amber-500 font-mono"
                />
                <button
                  onClick={fetchFromSource}
                  disabled={fetchingSource || running || !sourceKey}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-700 text-xs font-semibold hover:bg-amber-500/15 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {fetchingSource ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
                  {fetchingSource ? "Fetching…" : "Fetch from source"}
                </button>
              </div>
              {fetchError && <p className="mt-2 text-xs text-red-600">{fetchError}</p>}
              <PipelineSetup onRun={handleRunPipeline} onStop={stopPipeline} running={running} />
            </Card>

            {/* Running-agent banner + stop */}
            <div ref={agentSectionRef} className="scroll-mt-24 space-y-3">
            {(running || currentAgent) && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-amber-500/40 bg-amber-500/10">
                <Loader2 size={16} className="animate-spin text-amber-600 shrink-0" />
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
            )}
            </div>

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
                  onClick={resumePipeline}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600"
                >
                  <RotateCcw size={13} /> Retry from {failedAgent.code || "this agent"}
                </button>
              </div>
            )}

            {/* Live agent stream */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-text-muted">Agent activity</h3>
                {running && <Loader2 size={14} className="animate-spin text-amber-600" />}
              </div>
              <div className="max-h-[320px] overflow-y-auto agent-log-scroll">
                <AgentStream events={events} />
              </div>
            </Card>

            {/* Run summary — shown after a run completes */}
            {!running && events.length > 0 && <PipelineSummary events={events} />}

            {/* Step artifacts */}
            {analysis && <AnalysisView analysis={analysis} />}
            {coverage && <TestCasesEditor coverage={coverage} onEdit={saveCoverage} />}
            <ScriptView script={script} waiting={Boolean(coverage && !script)} />
            <TestRunReport run={testRun} />
            {script && (
              <TestRunner
                requirementId={requirement?.id ?? null}
                coverage={coverage}
                onRequirementText={(text) => setContent((c) => (text ? `${c}\n\n${text}` : c))}
              />
            )}
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

            {/* Optional GitHub check-in (Docker run is above in main column) */}
            <div>
              <button
                onClick={() => setDevOpsOpen((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-bg-surface hover:bg-bg-hover transition-colors"
              >
                <span className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  <GitBranch size={15} className="text-amber-600" />
                  Optional: check in to GitHub
                </span>
                <ChevronDown size={16} className={cn("text-text-muted transition-transform", devOpsOpen && "rotate-180")} />
              </button>
              {devOpsOpen && (
                <div className="mt-3">
                  <GitHubCheckin script={script} requirementId={requirement?.id ?? null} />
                </div>
              )}
            </div>
          </div>

          {/* Right rail */}
          <div className="space-y-6">
            <ConnectorsPanel />
            <ReleaseGauge report={release} />
            <RunHistory />
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
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-amber-700 transition-colors">
              <ArrowLeft size={14} /> Back to landing
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
