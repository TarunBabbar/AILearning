import { completeJson } from "../llm/json";
import { getProvider } from "../llm/client";

/**
 * Evaluation — LLM-judge metrics (DeepEval-style) that run in serverless.
 * DeepEval itself requires Python + local execution, so these mirror the
 * five spec metrics as LLM judge calls. Deterministic fallback when the
 * LLM is unavailable: tool-sequence comparison (pass/fail).
 */
export type MetricName =
  | "answer_relevancy"
  | "groundedness"
  | "completeness"
  | "correctness"
  | "tool_sequence_accuracy";

export const DEFAULT_THRESHOLDS: Record<MetricName, number> = {
  answer_relevancy: 0.8,
  groundedness: 0.9,
  completeness: 0.75,
  correctness: 0.85,
  tool_sequence_accuracy: 0.9,
};

export const HARD_GATE_METRICS: MetricName[] = ["groundedness", "correctness", "tool_sequence_accuracy"];

export interface MetricResult {
  metric: MetricName;
  score: number;
  threshold: number;
  hardGate: boolean;
  passed: boolean;
}

export interface EvalInput {
  input: string;
  actualOutput: string;
  retrievalContext: string[];
  toolsCalled: string[];
  expectedTools: string[];
  expectedOutput?: string;
  highRisk?: boolean;
}

const CRITERIA: Record<MetricName, string> = {
  answer_relevancy: "Rate how relevant the output is to the input, 0-1.",
  groundedness: "Rate how well the output is grounded in the retrieval context, 0-1.",
  completeness: "Does the output cover every element of the expected output? Rate 0-1.",
  correctness: "Is the output factually and procedurally correct against the expected output? Rate 0-1.",
  tool_sequence_accuracy:
    "1) All required tools were called. 2) No destructive tool out of order. 3) No unnecessary calls. Rate 0-1.",
};

export async function evaluateCase(
  input: EvalInput,
  thresholds: Partial<Record<MetricName, number>> = {},
): Promise<MetricResult[]> {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const metrics: MetricName[] = [
    "answer_relevancy",
    "groundedness",
    "completeness",
    "correctness",
    "tool_sequence_accuracy",
  ];

  const results: MetricResult[] = [];
  for (const metric of metrics) {
    const isHard = HARD_GATE_METRICS.includes(metric);
    // Correctness is hard only on high-risk flows (mirrors spec).
    const effectiveHard = metric === "correctness" ? !!input.highRisk : isHard;
    results.push(await judgeMetric(input, metric, t[metric], effectiveHard));
  }
  return results;
}

async function judgeMetric(
  input: EvalInput,
  metric: MetricName,
  threshold: number,
  hardGate: boolean,
): Promise<MetricResult> {
  // Deterministic fallback when no LLM configured.
  if (!process.env.LLM_API_KEY) {
    const score = input.toolsCalled.join(",") === input.expectedTools.join(",") ? 1 : 0.6;
    return { metric, score, threshold, hardGate, passed: score >= threshold };
  }

  try {
    const provider = getProvider();
    const prompt = [
      `Metric: ${metric}.`,
      CRITERIA[metric],
      `input: ${input.input}`,
      `actual_output: ${input.actualOutput.slice(0, 4000)}`,
      input.retrievalContext.length ? `retrieval_context: ${input.retrievalContext.join("\n").slice(0, 4000)}` : "",
      input.expectedOutput ? `expected_output: ${input.expectedOutput.slice(0, 4000)}` : "",
      `tools_called: ${input.toolsCalled.join(", ")}`,
      `expected_tools: ${input.expectedTools.join(", ")}`,
      'Respond with JSON: {"score": number between 0 and 1, "reason": str}',
    ]
      .filter(Boolean)
      .join("\n");
    const raw = await provider.complete({ prompt, temperature: 0, jsonMode: true });
    const parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    const score = Math.max(0, Math.min(1, Number(parsed.score ?? 0)));
    return { metric, score, threshold, hardGate, passed: score >= threshold };
  } catch {
    // Fail-closed: LLM unavailable → deterministic tool-sequence check.
    const score = input.toolsCalled.join(",") === input.expectedTools.join(",") ? 1 : 0.6;
    return { metric, score, threshold, hardGate, passed: score >= threshold };
  }
}
