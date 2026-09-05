// Orchestrator: runs the full 6-step pipeline from requirement to release
// confidence by chaining the specialist agents on a single traceability root.

import { runAgent } from "./runner";
import { insertOne, listAll, withWorkspace, currentWorkspace } from "../store";
import { isRunnableAutomation } from "../exec/script-quality";
import type { AgentEvent, Analysis, Coverage, Cycle, Defect, Evaluation, ReleaseReport, Requirement, Script } from "../types";
import type { RunRecord } from "../runs/store";

export interface OrchestrationResult {
  requirementId: string;
  events: AgentEvent[];
  /** Stable id for this orchestration — checkpoints + final save share it so a
   *  mid-run "partial" record is overwritten by the final one on completion. */
  runId: string;
}

export interface OrchestrationOptions {
  source?: string; // manual | jira | confluence | figma | image | other
  sourceKey?: string; // Jira issue key / Confluence page id / Figma file key
  title?: string;
  content?: string; // requirement text (persisted before the chain starts)
  // Start the chain from this agent index (for step-by-step / resume).
  startFrom?: number;
  // When resuming a paused run, the SAME runId keeps checkpoints + the final
  // record under one history entry (the resume merges the prior half's events).
  runId?: string;
  // Real Docker test results injected on resume so EX/DO record actual
  // executions instead of honestly reporting "not executed".
  testResults?: string;
  // Workspace the run belongs to. When set, the whole chain runs inside
  // withWorkspace() so every tool/store call is scoped to it.
  workspaceId?: string;
  // Optional user-provided values collected up front (intake form). Applied as
  // process.env overrides for the duration of the run so the agent tools can
  // use them (DOCKER_IMAGE, OPENAPI_SPEC, BRANCH).
  env?: Record<string, string>;
  // Abort signal — stops the chain between agents when the client disconnects.
  signal?: AbortSignal;
}

/**
 * connect → analyze → coverage → automate → execute → release.
 * Each agent receives the shared requirementId so all artifacts link back
 * to one traceability root (Idrikta's "traceability by design").
 */
export async function orchestrate(
  requirementId: string,
  emit: (e: AgentEvent) => void,
  opts: OrchestrationOptions = {}
): Promise<OrchestrationResult> {
  // Scope the whole run to the workspace (if provided) so every store call
  // made by tool handlers resolves the correct workspace.
  const run = () => orchestrateInner(requirementId, emit, opts);
  return opts.workspaceId ? withWorkspace(opts.workspaceId, run) : run();
}

async function orchestrateInner(
  requirementId: string,
  emit: (e: AgentEvent) => void,
  opts: OrchestrationOptions
): Promise<OrchestrationResult> {
  // Persist the traceability root up front so every agent's tools can load it.
  if (opts.content != null) {
    const existing = (await listAll<Requirement>("requirements")).find((r) => r.id === requirementId);
    if (!existing) {
      const req: Requirement = {
        id: requirementId,
        title: String(opts.title || "Untitled requirement"),
        source: String(opts.source || "manual") as Requirement["source"],
        sourceKey: opts.sourceKey ? String(opts.sourceKey) : undefined,
        content: String(opts.content),
        createdAt: new Date().toISOString(),
      };
      await insertOne("requirements", req);
      emit({ type: "artifact", agentId: "orchestrator", artifact: "requirement", id: requirementId });
    }
  }

  // Apply user-provided intake values for this run (restored afterwards).
  // Note: no workspace-secret merging — connectors are placeholders now.
  const overrides: Record<string, string | undefined> = {};
  if (opts.env) {
    for (const [k, v] of Object.entries(opts.env)) {
      if (v) {
        overrides[k] = process.env[k];
        process.env[k] = v;
      }
    }
  }
  const restore = () => {
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  };

  const allEvents: AgentEvent[] = [];
  // Reuse the runId passed on resume so checkpoints + the final save land on
  // the SAME history entry as the pre-pause half. Fresh run otherwise.
  const runId = opts.runId || crypto.randomUUID();
  // On resume, seed the event log with the paused run's prior events so the
  // final record shows one continuous timeline (not just the EX→IQ half).
  if (opts.runId && opts.startFrom) {
    try {
      const runs = await import("../runs/store");
      const prior = await runs.getRun(opts.runId, currentWorkspace()).catch(() => null);
      if (prior?.events?.length) allEvents.push(...(prior.events as AgentEvent[]));
    } catch {
      // best effort — a fresh event log is acceptable
    }
  }
  const chain: Array<{ id: Parameters<typeof runAgent>[0]["agentId"]; prompt: string }> = [
    {
      id: "requirement-intelligence",
      prompt: `Analyze requirement ${requirementId}${opts.title ? ` ("${opts.title}")` : ""}. The requirement is already saved — call requirement_analyze and return full requirement intelligence.`,
    },
    {
      id: "manual-test-case",
      prompt: `Design test coverage for requirement ${requirementId}. Load the saved analysis and save coverage via coverage_save.`,
    },
    {
      id: "automation-script",
      prompt: `Generate Playwright + TypeScript POM automation for requirement ${requirementId}.
1. Call coverage_get(requirementId).
2. Call automation_framework_generate(requirementId, coverageId) — REQUIRED.
3. Do NOT call script_save (payloads truncate on free models). Confirm the returned file list.`,
    },
    {
      id: "execution-defect",
      prompt: `Execute a controlled test cycle for requirement ${requirementId}: create a cycle, record pass/fail evidence per case, and raise defects for failures.`,
    },
    {
      id: "devops-execution",
      prompt: `Run the automated pipeline for requirement ${requirementId}: load the saved analysis and coverage, then simulate a CI/CD run that maps automated scripts to executions, records results on the cycle via execution_record, and raises defects via defect_create for failures. Link pipeline evidence back to the cycle.`,
    },
    {
      id: "quality-intelligence",
      prompt: `Produce a release-confidence report for requirement ${requirementId}. Call release_confidence and return the report.`,
    },
  ];

  let createdCycleId: string | undefined;
  // True when the chain paused at the AS→EX boundary awaiting a Docker run
  // decision. The paused half is saved as "partial" (resumable), not failed.
  let pausedForTestRun = false;
  // Real Docker results injected on resume (from the interactive run step).
  let testResults = opts.testResults;
  let lastTestRun: RunRecord["testRun"];

  try {
    for (let i = opts.startFrom ?? 0; i < chain.length; i++) {
      if (opts.signal?.aborted) break;
      const step = chain[i];
      const total = chain.length;

      // Build the prompt with any real context from earlier steps.
      let prompt = step.prompt;
      if (step.id === "devops-execution" && createdCycleId) {
        prompt += `\nA real test cycle exists: ${createdCycleId}. Use this exact cycleId in all execution_record / defect_create calls.`;
      } else if (step.id === "devops-execution") {
        prompt += `\nThere is NO real test cycle or run data for this requirement. Do not fabricate one — report that no real pipeline run was available.`;
      }
      if (step.id === "execution-defect" && createdCycleId) {
        prompt += `\nA real test cycle already exists: ${createdCycleId}. Use this exact cycleId — do NOT create a new cycle. Record the real results onto it.`;
      }
      if ((step.id === "execution-defect" || step.id === "devops-execution") && testResults) {
        prompt += `\nReal automated test results (from the local Docker run):\n${testResults}`;
      } else if (step.id === "execution-defect") {
        prompt += `\nThere are NO real automated test results — no Docker run happened for this requirement. Do not simulate or invent executions; report that tests were not run.`;
      }

      const events = await runAgent(
        {
          agentId: step.id,
          userPrompt: prompt,
          requirementId,
          lifecycle: { index: i, total },
          signal: opts.signal,
        },
        emit
      );
      allEvents.push(...events);

      // If this agent errored (LLM failure, rate limit), STOP the chain — the
      // downstream agents would only produce misleading output on bad input.
      if (events.some((e) => e.type === "error")) {
        emit({
          type: "status",
          agentId: "pipeline",
          message: `Agent ${step.id} failed — pipeline stopped. Fix the issue and re-run.`,
        });
        break;
      }

      // AI stage evaluation — ADVISORY ONLY (no eval-driven re-runs).
      // The judge scores this agent's output once against what was asked and
      // the chain always continues. Low scores are flagged in the log + run
      // record instead of re-running the agent — re-runs multiplied wall-clock
      // time by up to 3x per stage and pushed runs past Vercel's 5-min cap.
      const evalPassThreshold = 60;
      // EX is the only execute-stage agent that gets scored — DO operates on
      // the same cycle/executions, so judging it again is redundant and slow.
      const skipEval = step.id === "devops-execution";
      let ev: Evaluation | null = null;
      if (!skipEval) {
        ev = await runStageEval(step.id, requirementId, emit, createdCycleId, testResults, lastTestRun);
      }
      if (ev) {
        const evalEvent = {
          type: "evaluation" as const,
          agentId: step.id,
          stage: ev.stage,
          precision: ev.precision,
          accuracy: ev.accuracy,
          rationale: ev.rationale,
          completeness: ev.metrics?.completeness,
          hallucinatedCount: ev.metrics?.hallucinatedCount,
          missedCount: ev.metrics?.missedCount,
        };
        allEvents.push(evalEvent);
        // Emit so the client clears the "scoring…" state and shows the score.
        emit(evalEvent);
        if (ev.precision < evalPassThreshold || ev.accuracy < evalPassThreshold) {
          emit({
            type: "status",
            agentId: "pipeline",
            message: `AI Evaluation: ${step.id} scored ${ev.precision}% precision / ${ev.accuracy}% accuracy — below the ${evalPassThreshold}% bar, flagged in the run report.`,
          });
        }
      }

      // Durability checkpoint: persist everything completed so far (events +
      // next agent index). If the serverless function is killed at the 5-min
      // cap, the run survives as "partial" and the user can resume from here
      // instead of losing the whole run. Fire-and-forget — never block the chain.
      void saveRunCheckpoint(
        runId,
        requirementId,
        allEvents,
        opts,
        { cycleId: createdCycleId, testRun: lastTestRun, nextIndex: i + 1 }
      ).catch(() => {});

      // After AS generates scripts → run them in Docker with LLM auto-fix,
      // then record the REAL results on a cycle for EX/DO to reference.
      if (step.id === "automation-script") {
        if (opts.signal?.aborted) break;

        let script = (await listAll<Script>("scripts"))
          .filter((s) => s.requirementId === requirementId)
          .pop();
        if (script && !isRunnableAutomation(script.files).ok) {
          emit({
            type: "status",
            agentId: "pipeline",
            message: `Saved scripts incomplete (${isRunnableAutomation(script.files).reason}) — treating as missing.`,
          });
          script = undefined;
        }

        // Harden: if AS finished without script_save, retry once, then fallback generator.
        if ((!script || !script.files.length) && !opts.signal?.aborted) {
          emit({
            type: "status",
            agentId: "pipeline",
            message: "No scripts saved by AS — retrying automation agent once…",
          });
          const retryEvents = await runAgent(
            {
              agentId: "automation-script",
              userPrompt: `RETRY: You did not generate automation. For requirement ${requirementId}:
1. Call coverage_get now.
2. Call automation_framework_generate(requirementId, coverageId) immediately.
Do NOT call script_save. Do not return prose only.`,
              requirementId,
              lifecycle: { index: i, total },
              signal: opts.signal,
            },
            emit
          );
          allEvents.push(...retryEvents);
          if (retryEvents.some((e) => e.type === "error")) {
            emit({
              type: "status",
              agentId: "pipeline",
              message: "AS retry failed — trying deterministic fallback scripts from coverage…",
            });
          }
          script = (await listAll<Script>("scripts"))
            .filter((s) => s.requirementId === requirementId)
            .pop();
          if (script && !isRunnableAutomation(script.files).ok) script = undefined;
        }

        if ((!script || !script.files.length) && !opts.signal?.aborted) {
          const coverage = (await listAll<Coverage>("coverages"))
            .filter((c) => c.requirementId === requirementId)
            .pop();
          if (coverage?.testCases?.length) {
            const { saveFallbackScripts } = await import("../exec/fallback-scripts");
            script = await saveFallbackScripts(requirementId, coverage);
            emit({
              type: "status",
              agentId: "pipeline",
              message: `AS did not save scripts — generated ${script.files.length} Playwright fallback file(s) from coverage.`,
            });
            emit({ type: "artifact", agentId: "pipeline", artifact: "script", id: script.id });
          }
        }

        // API/contract tests: when an OpenAPI spec is provided via env
        // (OPENAPI_SPEC), parse it and merge generated tests/api specs into the
        // suite before the Docker run.
        const openapiSpec = opts.env?.OPENAPI_SPEC;
        if (openapiSpec && script && script.files.length) {
          try {
            const { parseOpenApi, buildApiSpecFiles, mergeApiSpecs, addApiTestScript } = await import("../exec/api-scripts");
            const { parse } = await import("yaml");
            let doc: Record<string, unknown> | null = null;
            const spec = openapiSpec.trim();
            if (/^https?:\/\//i.test(spec)) {
              const res = await fetch(spec);
              if (res.ok) {
                const text = await res.text();
                doc = spec.includes("yaml") || spec.includes(".yml") || !text.trim().startsWith("{") ? (parse(text) as Record<string, unknown>) : (JSON.parse(text) as Record<string, unknown>);
              }
            } else if (spec.startsWith("{")) {
              doc = JSON.parse(spec) as Record<string, unknown>;
            } else {
              doc = parse(spec) as Record<string, unknown>;
            }
            if (doc) {
              const index = parseOpenApi(doc);
              const apiFiles = buildApiSpecFiles(index);
              const merged = mergeApiSpecs(script, apiFiles);
              // Ensure the suite's package.json exposes test:api.
              const pkgIdx = merged.findIndex((f) => f.path === "package.json");
              if (pkgIdx >= 0) merged[pkgIdx] = { ...merged[pkgIdx], code: addApiTestScript(merged[pkgIdx].code) };
              script = { ...script, files: merged };
              emit({
                type: "status",
                agentId: "pipeline",
                message: `OpenAPI spec found — merged ${apiFiles.length} API contract spec(s) (${index.operations.length} operations) into the suite.`,
              });
            }
          } catch (err) {
            emit({
              type: "status",
              agentId: "pipeline",
              message: `Could not parse OpenAPI spec — running UI specs only. (${err instanceof Error ? err.message : String(err)})`,
            });
          }
        }

        if (script && script.files.length) {
          // Test execution now PAUSES for a user decision. The automation is
          // generated; the UI asks "Run on Docker?" and then RESUMES the chain
          // at the EX index (startFrom=3), optionally injecting real test
          // results so EX/DO record actual executions. Without a Docker host
          // (e.g. Vercel), the resume carries no results and EX/DO honestly
          // report "not executed". This keeps each request short and avoids
          // hard-wiring a Docker dependency into a serverless pipeline.
          emit({
            type: "status",
            agentId: "pipeline",
            message:
              "Automation suite ready. Test execution is paused — run the generated suite on Docker to get real pass/fail results for EX/DO.",
          });
          emit({
            type: "awaiting_test_run",
            agentId: "pipeline",
            requirementId,
            runId,
          });
          // Stop the chain here; the client resumes from the EX stage.
          pausedForTestRun = true;
          break;
        } else {
          emit({
            type: "error",
            agentId: "pipeline",
            message:
              "No generated scripts found after AS (+ retry). Check that coverage_get + automation_framework_generate succeeded.",
          });
          break;
        }
      }

      // After EX runs, capture the cycle it created so DO uses the real id.
      if (step.id === "execution-defect") {
        const cycle = (await listAll<Cycle>("cycles"))
          .filter((c) => c.requirementId === requirementId)
          .pop();
        if (cycle) {
          createdCycleId = cycle.id;
        }
      }
    }
  } finally {
    restore();
  }

  // Persist the run (events, generated code, test results) for later reference.
  // Same runId as the checkpoints → the final record overwrites the last
  // "partial" checkpoint instead of leaving duplicate history rows. A run that
  // paused at the AS→EX boundary is saved as "partial" (resumable), not failed.
  await saveRunRecord(runId, requirementId, allEvents, opts, createdCycleId, lastTestRun, pausedForTestRun);

  return { requirementId, events: allEvents, runId };
}

/**
 * DeepEval-style stage evaluation for the agent that just ran. Maps the agent
 * to its stage, loads the latest artifact and the previous stage's ask, and
 * scores precision/accuracy. Best-effort — returns null on any failure.
 */
async function runStageEval(
  agentId: string,
  requirementId: string,
  emit: (e: AgentEvent) => void,
  createdCycleId: string | undefined,
  testResults: string | undefined,
  lastTestRun: RunRecord["testRun"]
): Promise<Evaluation | null> {
  try {
    const { evaluateStage } = await import("../eval/run");
    const req = (await listAll<Requirement>("requirements")).find((r) => r.id === requirementId);
    const analysis = (await listAll<Analysis>("analyses")).filter((a) => a.requirementId === requirementId).pop();
    const coverage = (await listAll<Coverage>("coverages")).filter((c) => c.requirementId === requirementId).pop();
    const script = (await listAll<Script>("scripts")).filter((s) => s.requirementId === requirementId).pop();
    const cycle = (await listAll<Cycle>("cycles")).filter((c) => c.requirementId === requirementId).pop();
    const defects = (await listAll<Defect>("defects")).filter((d) => d.requirementId === requirementId);
    const release = (await listAll<ReleaseReport>("releases")).filter((r) => r.requirementId === requirementId).pop();

    const stageFor: Record<
      string,
      { stage: Evaluation["stage"]; artifact: unknown; inputText: string; outputItems: string[] }
    > = {
      "requirement-intelligence": {
        stage: "analyze",
        artifact: analysis,
        inputText: req?.content || "Requirement text",
        outputItems: analysis
          ? [
              ...(analysis.businessRules || []).map(String),
              ...(analysis.acceptanceCriteria || []).map(String),
              ...(analysis.edgeCases || []).map(String),
              ...(analysis.scenarios || []).map(String),
            ]
          : [],
      },
      "manual-test-case": {
        stage: "coverage",
        artifact: coverage,
        inputText: analysis ? JSON.stringify(analysis).slice(0, 6000) : "Analysis",
        outputItems: coverage ? coverage.testCases.map((t) => t.title || "") : [],
      },
      "automation-script": {
        stage: "automate",
        artifact: script,
        inputText: coverage ? coverage.testCases.map((t) => t.title).join("\n") : "Coverage",
        outputItems: script ? script.files.map((f) => f.path || "") : [],
      },
      "execution-defect": {
        stage: "execute",
        artifact: cycle,
        inputText: testResults || `Cycle: ${createdCycleId || "none"} — ${defects.length} defect(s)`,
        outputItems: cycle ? cycle.executions.map((e) => `${e.caseTitle} [${e.status}]`) : [],
      },
      "devops-execution": {
        stage: "execute",
        artifact: cycle,
        inputText: testResults || `Cycle: ${createdCycleId || "none"} — ${defects.length} defect(s)`,
        outputItems: cycle ? cycle.executions.map((e) => `${e.caseTitle} [${e.status}]`) : [],
      },
      "quality-intelligence": {
        stage: "release",
        artifact: release,
        inputText: JSON.stringify({
          coverageCases: coverage?.testCases.length || 0,
          defects: defects.length,
          testRun: lastTestRun,
        }).slice(0, 4000),
        outputItems: release ? [...(release.findings || []), ...(release.recommendations || [])] : [],
      },
    };

    const def = stageFor[agentId];
    if (!def || !def.artifact || !def.outputItems.length) return null;
    emit({ type: "eval_start", agentId, stage: def.stage });
    const evaluation = await evaluateStage({
      requirementId,
      stage: def.stage,
      agentId,
      artifactKind: def.stage === "analyze" ? "analyses" : def.stage === "coverage" ? "coverages" : def.stage === "automate" ? "scripts" : def.stage === "execute" ? "cycles" : "releases",
      artifactId: (def.artifact as { id: string }).id,
      inputText: def.inputText,
      outputItems: def.outputItems,
      outputText: JSON.stringify(def.artifact).slice(0, 12000),
    });
    emit({ type: "artifact", agentId: "pipeline", artifact: "evaluation", id: evaluation.id });
    return evaluation;
  } catch {
    return null;
  }
}

/** Build + persist a RunRecord from this orchestration. */
async function saveRunRecord(
  runId: string,
  requirementId: string,
  events: AgentEvent[],
  opts: OrchestrationOptions,
  cycleId?: string,
  testRun?: RunRecord["testRun"],
  paused = false
): Promise<void> {
  try {
    const runs = await import("../runs/store");
    const record = await buildRunRecord(runId, requirementId, events, opts, { cycleId, testRun, paused });
    // If a mid-run checkpoint already exists for this runId, keep its startedAt
    // so a resumed/timed-out run reads as one continuous timeline.
    const prior = await runs.getRun(runId, currentWorkspace()).catch(() => null);
    if (prior?.startedAt) record.startedAt = prior.startedAt;
    await runs.saveRun(record, currentWorkspace());
  } catch (err) {
    console.error("Failed to save run record:", err);
  }
}

interface CheckpointArgs {
  cycleId?: string;
  testRun?: RunRecord["testRun"];
  /** Index of the NEXT agent to run — the resume cursor after a timeout. */
  nextIndex: number;
}

/** Persist a durable mid-run checkpoint (status "partial") so a serverless
 *  timeout doesn't lose the whole run. Fire-and-forget from the chain loop. */
async function saveRunCheckpoint(
  runId: string,
  requirementId: string,
  events: AgentEvent[],
  opts: OrchestrationOptions,
  checkpoint: CheckpointArgs
): Promise<void> {
  try {
    const runs = await import("../runs/store");
    const record = await buildRunRecord(runId, requirementId, events, opts, checkpoint);
    record.status = "partial";
    // Tag the checkpoint with the resume cursor so the UI can offer
    // "Resume from stage N". Runs table has no such column, so it lives on
    // the JSONB record alongside the events.
    (record as unknown as { resumeFrom?: number }).resumeFrom = checkpoint.nextIndex;
    await runs.saveRun(record, currentWorkspace());
  } catch (err) {
    console.error("Failed to save run checkpoint:", err);
  }
}

/** Build a full RunRecord from the requirement + events so far. Used by both
 *  the final save and the mid-run checkpoint. */
async function buildRunRecord(
  runId: string,
  requirementId: string,
  events: AgentEvent[],
  opts: OrchestrationOptions,
  extra: { cycleId?: string; testRun?: RunRecord["testRun"]; paused?: boolean }
): Promise<RunRecord> {
  const req = (await listAll<Requirement>("requirements")).find((r) => r.id === requirementId);
  const coverage = (await listAll<Coverage>("coverages")).filter((c) => c.requirementId === requirementId).pop();
  const script = (await listAll<Script>("scripts")).filter((s) => s.requirementId === requirementId).pop();
  const defects = (await listAll<Defect>("defects")).filter((d) => d.requirementId === requirementId);
  const releases = (await listAll<ReleaseReport>("releases")).filter((r) => r.requirementId === requirementId);
  const analyses = await listAll<Analysis>("analyses");

  const agentMap = new Map<string, { code: string; name: string; status: "done" | "error" | "skipped" | "running"; index: number; total: number }>();
  for (const e of events as Array<Record<string, unknown>>) {
    if (e.type === "agent_start") {
      agentMap.set(String(e.agentId), { code: String(e.code), name: String(e.name), index: Number(e.index), total: Number(e.total), status: "running" });
    } else if (e.type === "agent_done" && agentMap.has(String(e.agentId))) {
      const a = agentMap.get(String(e.agentId))!;
      if (a.status !== "error") a.status = "done";
    } else if (e.type === "error" && agentMap.has(String(e.agentId))) {
      agentMap.get(String(e.agentId))!.status = "error";
    }
  }
  let sawError = false;
  const agents = [...agentMap.values()].sort((a, b) => a.index - b.index);
  for (const a of agents) {
    if (a.status === "error") sawError = true;
    else if (sawError) a.status = "skipped";
  }

  const issues = (events as Array<Record<string, unknown>>)
    .filter((e) => e.type === "error")
    .map((e) => `Agent ${e.agentId}: ${e.message}`);

  // DeepEval-style stage evaluations from this run (agent code → scores).
  const evaluations = (events as Array<Record<string, unknown>>)
    .filter((e) => e.type === "evaluation")
    .map((e) => {
      const id = String(e.agentId);
      const code = id === "pipeline" ? "PIPE" : id.split("-").map((p) => p[0]?.toUpperCase() || "").join("");
      return {
        agentCode: code,
        stage: String(e.stage),
        precision: Number(e.precision),
        accuracy: Number(e.accuracy),
      };
    });

  const startedAt = new Date().toISOString();
  return {
    id: runId,
    requirementId,
    title: req?.title || opts.title || "Untitled requirement",
    source: req?.source || "manual",
    startedAt,
    finishedAt: startedAt,
    // A run that paused at the AS→EX boundary is "partial" (resumable). An
    // agent error is "failed". Otherwise all agents finished = "success" —
    // zero defects is a legitimate "nothing failed" outcome, not a partial run.
    status: extra.paused ? "partial" : sawError ? "failed" : "success",
    agents,
    counts: {
      analyses: analyses.filter((a) => a.requirementId === requirementId).length,
      coverages: coverage ? 1 : 0,
      testCases: coverage?.testCases.length || 0,
      scripts: script?.files.length || 0,
      cycles: extra.cycleId ? 1 : 0,
      defects: defects.length,
      releases: releases.length,
      evaluations: evaluations.length,
    },
    evaluations,
    files: script?.files || [],
    events,
    issues,
    testRun: extra.testRun,
    // Carry the owning workspace on the record so the JSON-fallback filter
    // (which reads record.workspaceId) is user-scoped too.
    workspaceId: currentWorkspace(),
  } as RunRecord;
}
