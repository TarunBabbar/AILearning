// DeepEval-style stage evaluation — rubric + judge prompt builders.
//
// Each lifecycle stage is evaluated on how well the agent's OUTPUT delivered
// what the PREVIOUS stage asked for:
//   analyze  : requirement  → Analysis        (faithfulness + completeness)
//   coverage : Analysis     → test cases      (traceability + criteria coverage)
//   automate : Coverage     → Script files    (case→test mapping, buildability)
//   execute  : cycle/results → executions/defects (evidence fidelity)
//   release  : all artifacts → ReleaseReport  (numbers match the data)
//
// precision = % of output items that are justified/traceable to the input
// accuracy  = % of requested items (from the input) actually delivered
//
// The judge is a free OpenRouter model (EVAL_MODEL) — same GEval-style approach
// DeepEval uses with a custom LLM judge. If the judge call fails, run.ts falls
// back to a deterministic lexical overlap score so the pipeline never blocks.

import type { EvalStage } from "../types";

export interface EvalRubric {
  stage: EvalStage;
  title: string;
  inputDescription: string;
  outputDescription: string;
  precisionQuestion: string;
  accuracyQuestion: string;
}

export const RUBRICS: Record<EvalStage, EvalRubric> = {
  analyze: {
    stage: "analyze",
    title: "Requirement intelligence quality",
    inputDescription: "The raw requirement text the RI agent was given.",
    outputDescription: "The structured analysis it produced (summary, business rules, acceptance criteria, risks, edge cases, scenarios, test data).",
    precisionQuestion: "Is each item in the analysis (business rules, acceptance criteria, risks, edge cases, test data, summary) actually supported by the requirement text, with no hallucinated content?",
    accuracyQuestion: "Does the analysis cover every meaningful ask in the requirement — all acceptance criteria, rules, edge cases, and data the requirement mentions?",
  },
  coverage: {
    stage: "coverage",
    title: "Test coverage quality",
    inputDescription: "The requirement analysis (business rules, acceptance criteria, risks, edge cases).",
    outputDescription: "The generated manual test cases (title, priority, scenarioType, steps).",
    precisionQuestion: "Is each test case traceable to something in the analysis — a business rule, acceptance criterion, risk, or edge case — with no irrelevant 'weird' cases?",
    accuracyQuestion: "Do the test cases collectively cover all the acceptance criteria and key edge cases from the analysis (happy path, negative paths, boundaries)?",
  },
  automate: {
    stage: "automate",
    title: "Automation script fidelity",
    inputDescription: "The approved coverage (test cases) the AS agent was asked to automate.",
    outputDescription: "The generated Playwright + TypeScript POM files (pages, fixtures, specs, config).",
    precisionQuestion: "Is each generated test/spec mapped to a real test case from the coverage, with no orphan or fabricated tests?",
    accuracyQuestion: "Do the generated specs collectively cover the test cases from the coverage, and is the suite structurally runnable (package.json, playwright.config, valid TS)?",
  },
  execute: {
    stage: "execute",
    title: "Execution & defect fidelity",
    inputDescription: "The real test cycle results (passed/failed/skipped counts, failure evidence) — or the explicit absence of any real run.",
    outputDescription: "The recorded executions and raised defects (cycle_id, pass/fail evidence, defect summaries).",
    precisionQuestion: "Are all recorded executions and defects backed by real evidence from the run — with no fabricated passes, screenshots, or failures?",
    accuracyQuestion: "Do the recorded executions and defects correctly reflect the actual run results (every real failure raised, counts consistent, no invented results when no run happened)?",
  },
  release: {
    stage: "release",
    title: "Release report accuracy",
    inputDescription: "The pipeline artifacts: coverage, test run results, defects, and execution outcomes.",
    outputDescription: "The release-confidence report (confidence, risk, coveragePercent, passRate, openDefects, findings, recommendations).",
    precisionQuestion: "Are every number and finding in the report backed by the actual artifacts — no invented metrics or unsupported claims?",
    accuracyQuestion: "Do the report's metrics (coverage %, pass rate, open defects, confidence, risk) correctly reflect the real data from the pipeline?",
  },
};

/** Deterministic fallback scorer when the LLM judge is unavailable: token
 *  overlap between the output items and the input text. Never blocks the
 *  pipeline — always returns 0-100 scores. */
export function lexicalFallbackScore(
  inputText: string,
  outputItems: string[]
): { precision: number; accuracy: number } {
  if (!outputItems.length) return { precision: 0, accuracy: 0 };
  const input = inputText.toLowerCase();
  const terms = input.split(/[^a-z0-9]+/i).filter((w) => w.length > 3);
  if (!terms.length) return { precision: 50, accuracy: 50 };

  let justified = 0;
  for (const item of outputItems) {
    const t = item.toLowerCase();
    // An output item is "justified" if it shares a meaningful term with input.
    const hits = terms.filter((w) => t.includes(w));
    if (hits.length > 0) justified++;
  }
  const precision = Math.round((justified / outputItems.length) * 100);
  // Accuracy = how much of the input's content is echoed back in output items.
  const covered = terms.filter((w) => outputItems.some((o) => o.toLowerCase().includes(w))).length;
  const accuracy = Math.round((covered / terms.length) * 100);
  return { precision, accuracy };
}

/** Build the judge conversation for a stage. Returns JSON-only instruction. */
export function buildJudgeMessages(opts: {
  rubric: EvalRubric;
  inputText: string;
  outputText: string;
}): Array<{ role: "system" | "user"; content: string }> {
  const { rubric, inputText, outputText } = opts;
  const system = `You are a strict, unbiased QA evaluation judge (DeepEval-style GEval).
You score how well an AI agent's output delivered what the previous stage asked for.
Scoring rules:
- precision (0-100): percentage of OUTPUT items that are justified/traceable to the input, with no hallucination or irrelevant content.
- accuracy (0-100): percentage of the input's REQUESTS that the output actually delivered.
- Be critical. Unsupported claims lower precision; missing requirements lower accuracy.
- "overall": 1-2 plain sentences a non-technical user understands — what these scores mean for this stage (e.g. "The analysis captured most of the requirement, but two acceptance criteria were missed.").
- "improvements": 2-4 concrete, actionable ways to raise the scores (specific missing items, unclear output, things to redo).
- "judgeConfidence" (0-100): how confident you are in your precision/accuracy scores (low when the output is ambiguous or the input is thin).
Return ONLY a JSON object, no markdown, no prose:
{"precision": <0-100>, "accuracy": <0-100>, "judgeConfidence": <0-100>, "rationale": "<2-3 sentences>", "overall": "<1-2 plain sentences>", "improvements": ["<action 1>", "<action 2>"], "perItem": [{"item": "<output item or input ask>", "verdict": "pass|fail|partial", "reason": "<one sentence>"}]}`;

  const user = `Stage: ${rubric.title}
${rubric.inputDescription}
--- INPUT (what was asked) ---
${inputText.slice(0, 4000)}
${rubric.outputDescription}
--- OUTPUT (what was delivered) ---
${outputText.slice(0, 6000)}

Precision question: ${rubric.precisionQuestion}
Accuracy question: ${rubric.accuracyQuestion}
Evaluate and return the JSON object now.`;

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
