// Orchestrator: runs the full 6-step pipeline from requirement to release
// confidence by chaining the specialist agents on a single traceability root.

import { runAgent } from "./runner";
import { insertOne, listAll, withWorkspace, currentWorkspace } from "../store";
import { isRunnableAutomation } from "../exec/script-quality";
import type { AgentEvent, Analysis, Coverage, Cycle, Defect, ReleaseReport, Requirement, Script } from "../types";
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
  // use them. Keys are env var names (e.g. "GITHUB_TOKEN", "GITHUB_OWNER").
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
  const overrides: Record<string, string | undefined> = {};
  if (opts.env) {
    for (const [k, v] of Object.entries(opts.env)) {
      if (v) {
        overrides[k] = process.env[k];
        process.env[k] = v;
      }
    }
  }
  // Merge per-workspace connector secrets so agent-time connector calls
  // (jira_fetch_issue / confluence_fetch_page / figma_fetch_file during RI)
  // resolve the workspace's own credentials.
  const ws = currentWorkspace();
  if (ws && ws !== "default") {
    try {
      const { getWorkspaceSecrets } = await import("../db");
      const secrets = await getWorkspaceSecrets(ws);
      for (const [k, v] of Object.entries(secrets)) {
        if (v && !overrides[k]) {
          overrides[k] = process.env[k];
          process.env[k] = v;
        }
      }
    } catch {
      // ignore — env fallback stays
    }
  }
  const restore = () => {
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  };

  const allEvents: AgentEvent[] = [];
  const sourceHint =
    opts.source && opts.source !== "manual"
      ? `The requirement came from ${opts.source}${opts.sourceKey ? ` with key/id "${opts.sourceKey}"` : ""}. If the content was not already fetched, call the matching fetch tool (jira_fetch_issue / confluence_fetch_page / figma_fetch_file) to load it before analyzing.`
      : "";
  const chain: Array<{ id: Parameters<typeof runAgent>[0]["agentId"]; prompt: string }> = [
    {
      id: "requirement-intelligence",
      prompt: `Analyze requirement ${requirementId}${opts.title ? ` ("${opts.title}")` : ""}. ${sourceHint} Save it if not already saved, then analyze and return full requirement intelligence.`,
    },
    {
      id: "manual-test-case",
      prompt: `Design test coverage for requirement ${requirementId}. Load the saved analysis and save coverage via coverage_save. Ground new cases against existing cases with cases_search to avoid duplicates.`,
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

        if (script && script.files.length) {
          emit({ type: "status", agentId: "pipeline", message: "Running generated tests in Docker (auto-fix on failure)…" });
          try {
            const { runTestsWithAutofix } = await import("../exec/autofix");
            const res = await runTestsWithAutofix(script, { emitLog: (l) => emit({ type: "status", agentId: "pipeline", message: l }) });
            lastTestRun = {
              ok: res.ok,
              passed: res.summary.passed,
              failed: res.summary.failed,
              skipped: res.summary.skipped,
              total: res.summary.total,
              attempts: res.attempts,
              failures: res.failures,
              logs: res.logs,
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
      },
      files: script?.files || [],
      events,
      issues,
      testRun,
    };
    await runs.saveRun(record, currentWorkspace());
  } catch (err) {
    console.error("Failed to save run record:", err);
  }
}
