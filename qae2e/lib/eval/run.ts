// DeepEval-style stage evaluation runner.
//
// evaluateStage() judges one agent's output against the previous stage's ask
// using a free OpenRouter judge model (EVAL_MODEL), persists an Evaluation
// record, and returns it. On judge failure it falls back to a deterministic
// lexical score so the pipeline never blocks.

import { chatCompletion, LlmError } from "../llm/openrouter";
import { getConfig } from "../config";
import { insertOne } from "../store";
import type { Evaluation, EvalStage, EvalItemVerdict, EvalVerdict, EvalMetrics } from "../types";
import { RUBRICS, buildJudgeMessages, lexicalFallbackScore } from "./metrics";

export interface EvaluateStageOptions {
  requirementId: string;
  stage: EvalStage;
  agentId: string;
  artifactKind: string;
  artifactId: string;
  /** What the stage was asked to deliver (the previous artifact's text). */
  inputText: string;
  /** The output items to score (analysis fields, test case titles, …). */
  outputItems: string[];
  /** Raw output text for the judge (falls back to outputItems joined). */
  outputText?: string;
}

/** Extract a JSON object from a judge reply, tolerating fences/prose. */
function extractJson(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    } catch {
      // fall through
    }
  }
  const m = trimmed.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function clamp(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function parseVerdicts(raw: unknown): EvalItemVerdict[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 50).map((v) => {
    const x = (v || {}) as Record<string, unknown>;
    const verdict = String(x.verdict || "partial");
    return {
      item: String(x.item || ""),
      verdict: verdict === "pass" || verdict === "fail" ? verdict : "partial",
      reason: String(x.reason || ""),
    };
  });
}

function parseStrings(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(String).filter(Boolean).slice(0, 6);
}

/** Derive a human verdict from precision+accuracy. */
export function deriveVerdict(precision: number, accuracy: number, method: string): EvalVerdict {
  if (method === "fallback") return "fallback";
  const avg = (precision + accuracy) / 2;
  if (avg >= 85) return "excellent";
  if (avg >= 70) return "good";
  if (avg >= 50) return "needs-work";
  return "poor";
}

/** Derive extra metrics from per-item verdicts. Returns undefined when the
 *  judge supplied no per-item data (free models often omit it) so the UI shows
 *  "—" instead of misleading zeros. */
function deriveMetrics(perItem: EvalItemVerdict[], judgeConfidence?: number): EvalMetrics {
  const total = perItem.length;
  const pass = perItem.filter((v) => v.verdict === "pass").length;
  const fail = perItem.filter((v) => v.verdict === "fail").length;
  const partial = total - pass - fail;
  // "fail" items on the output side = hallucinated/off-topic; "fail"+"partial"
  // on the input side = missed. We approximate: fails are hallucinations,
  // partials+fails are the "needs attention" set.
  return {
    completeness: total ? Math.round((pass / total) * 100) : undefined,
    hallucinatedCount: total ? fail : undefined,
    missedCount: total ? fail + partial : undefined,
    judgeConfidence,
  };
}

export async function evaluateStage(opts: EvaluateStageOptions): Promise<Evaluation> {
  const cfg = getConfig();
  const rubric = RUBRICS[opts.stage];
  const outputText = opts.outputText || opts.outputItems.join("\n");
  const method = "llm-judge";
  let precision = 0;
  let accuracy = 0;
  let rationale = "";
  let overall = "";
  let improvements: string[] = [];
  let perItem: EvalItemVerdict[] = [];
  let verdict: EvalVerdict = "fallback";
  let metrics: EvalMetrics = { completeness: 0, hallucinatedCount: 0, missedCount: 0 };

  try {
    if (!cfg.openrouterApiKey) throw new LlmError("no API key");
    const messages = buildJudgeMessages({
      rubric,
      inputText: opts.inputText,
      outputText,
    });
    const res = await chatCompletion(messages, {
      model: cfg.evalModel,
      temperature: 0.1,
      maxTokens: 1024,
    });
    const text = res.choices[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) throw new LlmError("empty judge reply");
    const parsed = extractJson(text);
    if (!parsed) throw new LlmError("judge reply was not JSON");
    precision = clamp(parsed.precision);
    accuracy = clamp(parsed.accuracy);
    rationale = String(parsed.rationale || "");
    overall = String(parsed.overall || "");
    improvements = parseStrings(parsed.improvements);
    perItem = parseVerdicts(parsed.perItem);
    verdict = deriveVerdict(precision, accuracy, method);
    metrics = deriveMetrics(perItem, clamp(parsed.judgeConfidence));
    if (precision === 0 && accuracy === 0 && !rationale) throw new LlmError("judge returned no usable scores");
  } catch (err) {
    // Deterministic fallback — never block the pipeline on the judge.
    const fallback = lexicalFallbackScore(opts.inputText, opts.outputItems);
    precision = fallback.precision;
    accuracy = fallback.accuracy;
    rationale = `Judge model unavailable (${err instanceof Error ? err.message : String(err)}). Used deterministic lexical fallback.`;
    overall = "The automated judge could not score this stage, so a simple text-overlap estimate was used. Treat these numbers as a rough guide only.";
    improvements = ["Re-run the pipeline when the judge model (EVAL_MODEL) is available for a precise score."];
    perItem = [];
    verdict = "fallback";
    metrics = deriveMetrics([]);
    return {
      id: crypto.randomUUID(),
      requirementId: opts.requirementId,
      stage: opts.stage,
      agentId: opts.agentId,
      artifactKind: opts.artifactKind,
      artifactId: opts.artifactId,
      inputRef: opts.inputText.slice(0, 2000),
      precision,
      accuracy,
      rationale,
      overall,
      improvements,
      verdict,
      metrics,
      perItem,
      method: "fallback",
      createdAt: new Date().toISOString(),
    };
  }

  const evaluation: Evaluation = {
    id: crypto.randomUUID(),
    requirementId: opts.requirementId,
    stage: opts.stage,
    agentId: opts.agentId,
    artifactKind: opts.artifactKind,
    artifactId: opts.artifactId,
    inputRef: opts.inputText.slice(0, 2000),
    precision,
    accuracy,
    rationale,
    overall,
    improvements,
    verdict,
    metrics,
    perItem,
    method,
    createdAt: new Date().toISOString(),
  };

  try {
    await insertOne("evaluations", evaluation);
  } catch {
    // best effort — evaluation display is a bonus, never break the pipeline
  }
  return evaluation;
}
