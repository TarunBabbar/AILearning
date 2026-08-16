// Orchestrator: runs the full 6-step pipeline from requirement to release
// confidence by chaining the specialist agents on a single traceability root.

import { runAgent } from "./runner";
import { insertOne, listAll, withWorkspace, currentWorkspace } from "../store";
import { isRunnableAutomation } from "../exec/script-quality";
import type { AgentEvent, Analysis, Coverage, Cycle, Defect, Evaluation, ExecutionStatus, ReleaseReport, Requirement, Script } from "../types";
import type { RunRecord } from "../runs/store";

export interface OrchestrationResult {
  requirementId: string;
  events: AgentEvent[];
}

export interface OrchestrationOptions {
  source?: string; // manual | jira | confluence | figma | image | other
  sourceKey?: string; // Jira issue key / Confluence page id / Figma file key
  title?: string;
  content?: string; // requirement text (persisted before the chain starts)
  // Start the chain from this agent index (for step-by-step / resume).
  startFrom?: number;
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
  let testResults: string | undefined;
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

      // DeepEval-style stage evaluation + EVAL-DRIVEN RETRY:
      // The judge scores this agent's output against what was asked. If the
      // output doesn't match (precision/accuracy below the threshold), the
      // agent is re-run with the judge's feedback (rationale + improvements)
      // so the next attempt is aligned with the requirement. This is the core
      // "understand → verify → redo until correct" loop.
      const evalPassThreshold = 60; // precision OR accuracy must be >= this to proceed
      const maxEvalRetries = 2;
      let attempts = 0;
      let ev = await runStageEval(step.id, requirementId, emit, createdCycleId, testResults, lastTestRun);
      // Retry when the output scored below threshold OR no artifact was
      // produced at all (agent replied with prose instead of its deliverable).
      while (attempts < maxEvalRetries && !opts.signal?.aborted && (ev === null || ev.precision < evalPassThreshold || ev.accuracy < evalPassThreshold)) {
        attempts++;
        const retryNote = ev
          ? `AI Evaluation: ${step.id} output scored ${ev.precision}% precision / ${ev.accuracy}% accuracy — re-running with feedback (attempt ${attempts}/${maxEvalRetries}).`
          : `AI Evaluation: ${step.id} produced no deliverable — re-running (attempt ${attempts}/${maxEvalRetries}).`;
        emit({ type: "status", agentId: "pipeline", message: retryNote });
        emit({
          type: "eval_retry",
          agentId: step.id,
          stage: ev?.stage ?? "analyze",
          attempt: attempts,
          maxAttempts: maxEvalRetries,
          precision: ev?.precision ?? 0,
          accuracy: ev?.accuracy ?? 0,
          feedback: retryNote,
        });
        allEvents.push({
          type: "eval_retry",
          agentId: step.id,
          stage: ev?.stage ?? "analyze",
          attempt: attempts,
          maxAttempts: maxEvalRetries,
          precision: ev?.precision ?? 0,
          accuracy: ev?.accuracy ?? 0,
          feedback: retryNote,
        });
        const feedback = ev
          ? [
              `The AI judge scored your previous output as precision ${ev.precision}% and accuracy ${ev.accuracy}%.`,
              ev.rationale ? `Judge feedback: ${ev.rationale}` : "",
              ev.improvements?.length ? `Required fixes:\n${ev.improvements.map((i) => `- ${i}`).join("\n")}` : "",
              "Re-run your tools and produce a corrected, complete output that fully matches the requirement. Do not repeat the same mistakes.",
            ]
              .filter(Boolean)
              .join("\n\n")
          : "You did not produce your deliverable. Use your tools and return the required output (analysis / coverage / script / cycle+defects / release report) as instructed. Do not reply with prose alone.";
        const retryEvents = await runAgent(
          {
            agentId: step.id,
            userPrompt: `${prompt}\n\n${feedback}`,
            requirementId,
            lifecycle: { index: i, total },
            signal: opts.signal,
          },
          emit
        );
        allEvents.push(...retryEvents);
        if (opts.signal?.aborted) break;
        if (retryEvents.some((e) => e.type === "error")) {
          emit({ type: "status", agentId: "pipeline", message: `Agent ${step.id} retry errored — moving on.` });
          break;
        }
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
      }
      if (attempts > 0) {
        emit({
          type: "status",
          agentId: "pipeline",
          message: `AI Evaluation: ${step.id} finalized at ${ev?.precision ?? 0}% precision / ${ev?.accuracy ?? 0}% accuracy after ${attempts} retr${attempts === 1 ? "y" : "ies"}.`,
        });
      }

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
          // Note: PR-diff risk-based selection was removed with the GitHub
          // connector (now a placeholder) — the full suite always runs.
          emit({ type: "status", agentId: "pipeline", message: "Running generated tests in Docker (auto-fix on failure)…" });
          try {
            const { runTestsWithAutofix } = await import("../exec/autofix");
            const res = await runTestsWithAutofix(script, {
              emitLog: (l) => emit({ type: "status", agentId: "pipeline", message: l }),
            });
            lastTestRun = {
              ok: res.ok,
              passed: res.summary.passed,
              failed: res.summary.failed,
              skipped: res.summary.skipped,
              total: res.summary.total,
              attempts: res.attempts,
              failures: res.failures,
              logs: res.logs,
              results: res.results?.map((r) => ({ test: r.test, status: r.status, durationMs: r.durationMs })) || undefined,
            };
            const s = res.summary;
            testResults = `Passed: ${s.passed}, Failed: ${s.failed}, Skipped: ${s.skipped}, Total: ${s.total} (after ${res.attempts} run attempt(s))`;
            emit({
              type: "test_run",
              agentId: "pipeline",
              ok: res.ok,
              passed: s.passed,
              failed: s.failed,
              skipped: s.skipped,
              total: s.total,
              attempts: res.attempts,
              failures: res.failures.slice(0, 10),
              logs: res.logs.slice(-40),
              results: res.results?.slice(0, 200).map((r) => ({ test: r.test, status: r.status, durationMs: r.durationMs })),
              message: res.ok
                ? `Tests passed (${s.passed}/${s.total}) after ${res.attempts} attempt(s).`
                : res.attempts === 0
                  ? res.logs[0] || "Docker run did not start."
                  : `Tests still failing (${s.failed} failed) after ${res.attempts} attempts.`,
            });
            emit({
              type: "status",
              agentId: "pipeline",
              message: res.ok
                ? `Tests passed (${s.passed}/${s.total}) after ${res.attempts} attempt(s).`
                : res.attempts === 0
                  ? res.logs[0] || "Docker run did not start — skipping result recording."
                  : `Tests still failing (${s.failed} failed) after ${res.attempts} attempts.`,
            });

            // Persist a cycle whenever Docker actually attempted a run (pass or fail).
            if (res.attempts > 0) {
              const executions: Cycle["executions"] = [];
              // Prefer per-test detail from the Playwright JSON results so the
              // cycle (and the AI Evaluation of the execute stage) reflects
              // every real test instead of one aggregate "Passed (15)" row.
              if (res.results?.length) {
                for (const r of res.results) {
                  const norm = (r.status === "timedOut" || r.status === "interrupted" ? "failed" : r.status) as ExecutionStatus;
                  executions.push({
                    id: crypto.randomUUID(),
                    caseId: crypto.randomUUID(),
                    caseTitle: r.test,
                    status: norm,
                    evidence: `Playwright JSON reporter — ${r.status}${r.durationMs ? ` (${r.durationMs}ms)` : ""}`,
                    executedBy: "autofix-runner",
                    executedAt: new Date().toISOString(),
                  });
                }
              }
              if (!executions.length) {
                if (s.passed > 0) {
                  executions.push({
                    id: crypto.randomUUID(),
                    caseId: "suite-passed",
                    caseTitle: `Passed (${s.passed})`,
                    status: "passed",
                    evidence: "Docker autofix run",
                    executedBy: "autofix-runner",
                    executedAt: new Date().toISOString(),
                  });
                }
                if (s.failed > 0) {
                  executions.push({
                    id: crypto.randomUUID(),
                    caseId: "suite-failed",
                    caseTitle: `Failed (${s.failed})`,
                    status: "failed",
                    evidence: res.failures.map((f) => f.test + ": " + f.message.slice(0, 80)).join("\n"),
                    executedBy: "autofix-runner",
                    executedAt: new Date().toISOString(),
                  });
                }
                if (s.skipped > 0) {
                  executions.push({
                    id: crypto.randomUUID(),
                    caseId: "suite-skipped",
                    caseTitle: `Skipped (${s.skipped})`,
                    status: "skipped",
                    evidence: "",
                    executedBy: "autofix-runner",
                    executedAt: new Date().toISOString(),
                  });
                }
                if (executions.length === 0) {
                  executions.push({
                    id: crypto.randomUUID(),
                    caseId: "suite-empty",
                    caseTitle: "Suite completed with no parsed Playwright results",
                    status: res.ok ? "passed" : "failed",
                    evidence: res.logs.slice(-5).join("\n"),
                    executedBy: "autofix-runner",
                    executedAt: new Date().toISOString(),
                  });
                }
              }
              const cycle: Cycle = {
                id: crypto.randomUUID(),
                requirementId,
                name: "Automated Docker run (autofix)",
                status: "completed",
                executions,
                createdAt: new Date().toISOString(),
              };
              await insertOne("cycles", cycle);
              createdCycleId = cycle.id;
              emit({ type: "artifact", agentId: "pipeline", artifact: "cycle", id: cycle.id });
            }
          } catch (err) {
            emit({ type: "error", agentId: "pipeline", message: `Autofix run failed: ${err instanceof Error ? err.message : String(err)}` });
          }
        } else {
          emit({
            type: "error",
            agentId: "pipeline",
            message:
              "No generated scripts found after AS (+ retry) — skipping Docker. Check that coverage_get + automation_framework_generate succeeded.",
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
  await saveRunRecord(requirementId, allEvents, opts, createdCycleId, lastTestRun);

  return { requirementId, events: allEvents };
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
  requirementId: string,
  events: AgentEvent[],
  opts: OrchestrationOptions,
  cycleId?: string,
  testRun?: RunRecord["testRun"]
): Promise<void> {
  try {
    const runs = await import("../runs/store");

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

    const record: RunRecord = {
      id: crypto.randomUUID(),
      requirementId,
      title: req?.title || opts.title || "Untitled requirement",
      source: req?.source || "manual",
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      status: sawError ? "failed" : defects.length > 0 ? "partial" : "success",
      agents,
      counts: {
        analyses: analyses.filter((a) => a.requirementId === requirementId).length,
        coverages: coverage ? 1 : 0,
        testCases: coverage?.testCases.length || 0,
        scripts: script?.files.length || 0,
        cycles: cycleId ? 1 : 0,
        defects: defects.length,
        releases: releases.length,
        evaluations: evaluations.length,
      },
      evaluations,
      files: script?.files || [],
      events,
      issues,
      testRun,
      // Carry the owning workspace on the record so the JSON-fallback filter
      // (which reads record.workspaceId) is user-scoped too.
      workspaceId: currentWorkspace(),
    } as RunRecord;
    await runs.saveRun(record, currentWorkspace());
  } catch (err) {
    console.error("Failed to save run record:", err);
  }
}
