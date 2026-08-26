"""DeepEval sidecar for Agent 6 (Evaluation).

Exposes two endpoints over HTTP so the TypeScript orchestrator can grade
agent outputs without needing Python in the main process:

  POST /evaluate/test-cases  -> faithfulness + hallucination of generated test cases
  POST /evaluate/drift       -> quality of a drift report

Run:  python -m uvicorn agents.evaluation.main:app --host 127.0.0.1 --port 8010
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel

try:
    from deepeval import evaluate
    from deepeval.metrics import FaithfulnessMetric, HallucinationMetric
    from deepeval.test_case import LLMTestCase

    HAS_DEEPEVAL = True
except ImportError:  # pragma: no cover
    HAS_DEEPEVAL = False

app = FastAPI(title="Figma UI Automation — Eval Sidecar")


class TestCaseItem(BaseModel):
    id: str
    title: str
    scenario: str
    expected: str


class TestCaseEvalRequest(BaseModel):
    screenId: str
    sourceText: str  # design spec summary (the "context" the cases must stay faithful to)
    cases: list[TestCaseItem]


class DriftEvalRequest(BaseModel):
    screenId: str
    reportSummary: str
    deltas: list[dict[str, Any]]


def _verdict(score: float) -> str:
    if score >= 0.8:
        return "pass"
    if score >= 0.6:
        return "warn"
    return "fail"


def _fallback_faithfulness(source: str, case: TestCaseItem) -> float:
    """Cheap heuristic when deepeval isn't installed: does the case reference
    only elements that appear in the source? Never a substitute for real evals."""
    import re

    tokens = set(re.findall(r"[a-z0-9-]{3,}", source.lower()))
    case_tokens = set(re.findall(r"[a-z0-9-]{3,}", (case.scenario + " " + case.expected).lower()))
    missing = case_tokens - tokens
    if len(case_tokens) == 0:
        return 1.0
    return max(0.0, 1.0 - len(missing) / len(case_tokens))


@app.post("/evaluate/test-cases")
def evaluate_test_cases(req: TestCaseEvalRequest) -> dict[str, Any]:
    results = []
    for case in req.cases:
        if HAS_DEEPEVAL:
            test_case = LLMTestCase(
                input=req.sourceText,
                actual_output=f"{case.scenario} -> {case.expected}",
            )
            faithfulness = FaithfulnessMetric(threshold=0.7)
            hallucination = HallucinationMetric(threshold=0.3)
            evaluate([test_case], [faithfulness, hallucination])
            score = faithfulness.score
            hall = hallucination.score
            method = "deepeval"
        else:
            score = _fallback_faithfulness(req.sourceText, case)
            hall = 1.0 - score
            method = "heuristic-fallback"

        results.append(
            {
                "id": case.id,
                "faithfulness": round(score, 3),
                "hallucination": round(hall, 3),
                "verdict": _verdict(score),
                "method": method,
            }
        )

    avg = sum(r["faithfulness"] for r in results) / max(1, len(results))
    return {
        "screenId": req.screenId,
        "overall": {"faithfulness": round(avg, 3), "verdict": _verdict(avg)},
        "results": results,
        "method": "deepeval" if HAS_DEEPEVAL else "heuristic-fallback",
    }


@app.post("/evaluate/drift")
def evaluate_drift(req: DriftEvalRequest) -> dict[str, Any]:
    """Grade a drift report: are the flagged deltas real, specific, and actionable?"""
    critical = sum(1 for d in req.deltas if d.get("severity") == "critical")
    major = sum(1 for d in req.deltas if d.get("severity") == "major")
    total = len(req.deltas)
    specificity = sum(1 for d in req.deltas if d.get("detail") and len(str(d.get("detail"))) > 20)
    score = 0.0
    if total:
        score = 0.4 * min(1.0, (critical + major) / max(1, total)) + 0.6 * (specificity / total)
    return {
        "screenId": req.screenId,
        "score": round(score, 3),
        "verdict": _verdict(score),
        "summary": req.reportSummary,
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "deepeval": "available" if HAS_DEEPEVAL else "missing"}
