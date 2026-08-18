"""DeepEval metric wiring — workspace-scoped, thresholds from settings.

Metrics (spec §7):
  - AnswerRelevancyMetric  (soft, 0.8)
  - FaithfulnessMetric     (hard, 0.9)   → groundedness
  - GEval Completeness     (0.75)
  - GEval Correctness      (hard on high-risk, 0.85)
  - Custom ToolSequenceAccuracy (0.9)   → all required tools called, no
                                        out-of-order destructive calls, no extras

Thresholds are read from workspace settings at run time and snapshotted into
the Run record — never hardcoded in the metric definitions.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

# DeepEval is optional at import time (heavy); import lazily inside functions.
try:
    from deepeval.metrics import AnswerRelevancyMetric, FaithfulnessMetric, GEval
    from deepeval.test_case import LLMTestCase

    _DEEPEVAL_AVAILABLE = True
except ImportError:  # pragma: no cover
    _DEEPEVAL_AVAILABLE = False

    class GEval:  # stub so ToolSequenceAccuracy can still be defined
        def __init__(self, *args, **kwargs):
            self.score = 0.0
            self.threshold = kwargs.get("threshold", 0.9)
            self.success = False

        def is_successful(self) -> bool:
            return self.success

        def measure(self, *args, **kwargs) -> None:
            pass

DEFAULT_THRESHOLDS: dict[str, float] = {
    "answer_relevancy": 0.8,
    "groundedness": 0.9,
    "completeness": 0.75,
    "correctness": 0.85,
    "tool_sequence_accuracy": 0.9,
}

# Metrics that block the release gate when they fail.
HARD_GATE_METRICS = {"groundedness", "correctness", "tool_sequence_accuracy"}


@dataclass
class EvalInput:
    """One LLMTestCase worth of data, assembled by the eval layer."""

    input: str  # user query / flow under test
    actual_output: str  # model or app response
    retrieval_context: list[str]  # groundedness context
    tools_called: list[str]  # actual tool sequence
    expected_tools: list[str]  # from Jira acceptance criteria (ground truth)
    expected_output: str | None = None  # golden answer (existing tests / Jira AC)
    high_risk: bool = False


@dataclass
class MetricResult:
    metric: str
    score: float
    threshold: float
    hard_gate: bool
    passed: bool


# Canonical snake_case names shared by thresholds, filters, and the dashboard.
# Class-name forms from DeepEval are normalized to these.
METRIC_ALIASES: dict[str, str] = {
    "answerrelevancymetric": "answer_relevancy",
    "answer_relevancy": "answer_relevancy",
    "faithfulnessmetric": "groundedness",
    "groundedness": "groundedness",
    "completeness": "completeness",
    "correctness": "correctness",
    "toolsequenceaccuracy": "tool_sequence_accuracy",
    "tool_sequence_accuracy": "tool_sequence_accuracy",
}


def canonical_metric_name(name: str) -> str:
    return METRIC_ALIASES.get(name, name)


def evaluate_case(case: EvalInput, thresholds: dict[str, float] | None = None) -> list[MetricResult]:
    """Run all five metrics against one case. Returns per-metric results."""
    if not _DEEPEVAL_AVAILABLE:
        # Offline/eval-stub mode — deterministic pass-through for tests.
        return _stub_results(case, thresholds)

    t = {**DEFAULT_THRESHOLDS, **(thresholds or {})}
    tc = LLMTestCase(
        input=case.input,
        actual_output=case.actual_output,
        retrieval_context=case.retrieval_context,
        tools_called=case.tools_called,
        expected_tools=case.expected_tools,
        expected_output=case.expected_output or case.actual_output,
    )

    answer_relevancy = AnswerRelevancyMetric(threshold=t["answer_relevancy"])
    groundedness = FaithfulnessMetric(threshold=t["groundedness"])
    completeness = GEval(
        name="Completeness",
        criteria="Does the response cover every element required by the Jira acceptance criteria?",
        evaluation_params=["input", "actual_output", "expected_output"],
        threshold=t["completeness"],
    )
    correctness = GEval(
        name="Correctness",
        criteria="Is the response factually and procedurally correct against the golden answer?",
        evaluation_params=["input", "actual_output", "expected_output"],
        threshold=t["correctness"],
    )
    tool_sequence = ToolSequenceAccuracy(threshold=t["tool_sequence_accuracy"])

    results = []
    for metric in (
        (answer_relevancy, False),
        (groundedness, True),
        (completeness, False),
        (correctness, case.high_risk),
        (tool_sequence, True),
    ):
        m, hard = metric
        m.measure(tc)
        results.append(
            MetricResult(
                metric=canonical_metric_name(m.__class__.__name__.lower()),
                score=float(m.score),
                threshold=float(m.threshold),
                hard_gate=hard,
                passed=bool(m.is_successful()),
            )
        )
    return results


def _stub_results(case: EvalInput, thresholds: dict[str, float] | None) -> list[MetricResult]:
    """Deterministic stub for local dev without deepeval installed."""
    t = {**DEFAULT_THRESHOLDS, **(thresholds or {})}
    out: list[MetricResult] = []
    for name, hard in (
        ("answer_relevancy", False),
        ("groundedness", True),
        ("completeness", False),
        ("correctness", case.high_risk),
        ("tool_sequence_accuracy", True),
    ):
        score = 1.0 if case.tools_called == case.expected_tools else 0.6
        threshold = t.get(name, DEFAULT_THRESHOLDS[name])
        out.append(
            MetricResult(
                metric=name,
                score=score,
                threshold=threshold,
                hard_gate=hard,
                passed=score >= threshold,
            )
        )
    return out


class ToolSequenceAccuracy(GEval):
    """Custom metric: tool-sequence correctness (spec §7)."""

    def __init__(self, threshold: float = 0.9):
        super().__init__(
            name="ToolSequenceAccuracy",
            criteria=(
                "1) All required tools from expected_tools were called. "
                "2) No destructive/irreversible tool was called out of expected order. "
                "3) No unnecessary tool calls occurred."
            ),
            evaluation_params=["tools_called", "expected_tools"],
            threshold=threshold,
        )
