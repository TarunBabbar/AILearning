// Shared artifact persistence for agent runs.
// Both the single-agent route (/api/agents/[agentId]) and the pipeline route
// (/api/pipeline) call this on each agent's final chunk so structured outputs
// (analysis / coverage / script / release) survive the run and show up in the
// traceability rail and summary.

import { insertOne, listAll } from "../store";
import type { Analysis, AgentId, Coverage, ReleaseReport, Script } from "../types";

export type PersistedArtifact = { type: "analysis" | "coverage" | "script" | "release"; id: string };

/** Extract the first JSON object from a string, tolerating markdown fences/prose. */
function extractJson(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      // fall through to regex extraction
    }
  }
  // Find a JSON object embedded in prose (e.g. ```json ... ``` or "Return: {...}").
  const m = trimmed.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const parsed = JSON.parse(m[0]);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Best-effort persistence of the final structured JSON each agent produces.
 * `requirementId` is injected when the model omits it (common for free models).
 */
export function maybePersistArtifact(
  agentId: AgentId,
  text: string,
  requirementId?: string
): PersistedArtifact | null {
  const parsed = extractJson(text);
  if (!parsed) return null;
  const rid = String(parsed.requirementId || requirementId || "");

  if (agentId === "requirement-intelligence" && Array.isArray(parsed.acceptanceCriteria)) {
    const a: Analysis = {
      id: crypto.randomUUID(),
      requirementId: rid,
      summary: String(parsed.summary || ""),
      businessRules: (parsed.businessRules as string[]) || [],
      acceptanceCriteria: (parsed.acceptanceCriteria as string[]) || [],
      risks: (parsed.risks as Analysis["risks"]) || [],
      edgeCases: (parsed.edgeCases as string[]) || [],
      scenarios: (parsed.scenarios as string[]) || [],
      testData: (parsed.testData as string[]) || [],
      missingInfo: (parsed.missingInfo as string[]) || [],
      createdAt: new Date().toISOString(),
    };
    insertOne("analyses", a);
    return { type: "analysis", id: a.id };
  }

  if (agentId === "manual-test-case" && Array.isArray(parsed.testCases)) {
    const c: Coverage = {
      id: crypto.randomUUID(),
      requirementId: rid,
      product: parsed.product ? String(parsed.product) : undefined,
      module: parsed.module ? String(parsed.module) : undefined,
      testCases: (parsed.testCases as Coverage["testCases"]) || [],
      createdAt: new Date().toISOString(),
    };
    insertOne("coverages", c);
    return { type: "coverage", id: c.id };
  }

  if (agentId === "automation-script" && Array.isArray(parsed.files)) {
    const requirementIdFinal = rid;
    const coverage = listAll<Coverage>("coverages")
      .filter((c) => c.requirementId === requirementIdFinal)
      .pop();
    const s: Script = {
      id: crypto.randomUUID(),
      requirementId: requirementIdFinal,
      coverageId: coverage?.id || String(parsed.coverageId || ""),
      framework: parsed.framework ? String(parsed.framework) : "playwright",
      language: parsed.language ? String(parsed.language) : "typescript",
      files: (parsed.files as Script["files"]) || [],
      createdAt: new Date().toISOString(),
    };
    insertOne("scripts", s);
    return { type: "script", id: s.id };
  }

  if (agentId === "quality-intelligence" && typeof parsed.confidence === "number") {
    const r: ReleaseReport = {
      id: crypto.randomUUID(),
      requirementId: rid,
      confidence: Math.round(Number(parsed.confidence)),
      risk: (parsed.risk as ReleaseReport["risk"]) || "medium",
      summary: String(parsed.summary || ""),
      coveragePercent: Math.round(Number(parsed.coveragePercent || 0)),
      passRate: Math.round(Number(parsed.passRate || 0)),
      openDefects: Math.round(Number(parsed.openDefects || 0)),
      findings: (parsed.findings as string[]) || [],
      recommendations: (parsed.recommendations as string[]) || [],
      createdAt: new Date().toISOString(),
    };
    insertOne("releases", r);
    return { type: "release", id: r.id };
  }

  return null;
}
