# Senior AI QA Engineer — Interview Prep Plan (NL2SQL Platform)

**Goal:** Clear the interview. Prioritized so that if time runs short, the highest-impact topics are covered first.

---

## Priority 0 — Non-Negotiable Foundations (Days 1–3)

These are baseline filters. If shaky here, nothing else matters.

### Python + Pytest
- Fixtures, `parametrize`, `conftest.py`, markers, assert patterns
- Writing a test **framework** structure (not just individual tests)
- `pytest.ini` / config
- Plugins: `pytest-xdist` (parallel runs), `pytest-html` (reporting)

### SQL & NL2SQL Validation Logic
- Solid SQL: joins, aggregations, window functions, subqueries
- How to validate NL2SQL output (the heart of this role):
  - **Execution accuracy** — run generated SQL vs. gold SQL, compare *result sets*, not just query text
  - **Exact match vs. semantic match** — two different SQL queries can return identical data; validation must handle that (e.g., compare result dataframes, sorted, tolerant of column order)
  - Common failure modes: wrong table/column mapping, ambiguous joins, incorrect aggregation, hallucinated columns

### REST API Testing
- `requests` / `httpx` in Python
- Status codes, schema validation (`pydantic` / `jsonschema`)
- Auth headers, mocking with `responses` or `pytest-mock`

---

## Priority 1 — Core AI QA Concepts (Days 3–7)

This is what differentiates "QA engineer" from "AI QA engineer." Expect deep questions here.

### LLM Evaluation Fundamentals
- Deterministic testing (traditional QA) vs. probabilistic testing (LLM QA)
- Types of evals:
  - Reference-based (compare to gold answer)
  - Reference-free (LLM-as-judge)
  - Rule-based (regex/schema checks)
- **LLM-as-a-judge** — how it works, its biases, how to validate the judge itself

### AI Evaluation Metrics (know formulas + when each applies)
- Precision, Recall, F1 — classification-style evals (e.g., did retrieval return the right docs)
- **EM (Exact Match)** — common in NL2SQL/QA tasks
- **MRR (Mean Reciprocal Rank)** — ranking quality (e.g., was the right table/doc in the top-k)
- Be ready to explain each with an NL2SQL example, not just a textbook definition

### Golden Dataset & Benchmarking Design
- Building a golden dataset: diverse query types (simple/complex/ambiguous/edge cases), schema variety, expected SQL + expected result set
- Versioning golden datasets, tracking regression across model/prompt versions
- Benchmarking strategy: baseline → track drift after prompt/model changes

### Prompt Regression Testing
- Snapshot testing prompts (input → expected output structure)
- Semantic diffing of outputs across prompt versions
- CI-style gating: block deployment if eval score drops below threshold

---

## Priority 2 — Tooling (Days 7–10)

Pick **one tool deeply** (LangSmith or Langfuse — most common in enterprise NL2SQL contexts). Know the *concepts* of the rest.

- **Tracing/Observability concepts**: spans, traces, token usage, latency per step, cost tracking
- Hands-on: small project logging traces + eval scores in LangSmith or Langfuse
- Conceptual only: MLflow (experiment tracking + eval), Arize Phoenix (embedding/drift visualization, RAG-focused)

---

## Priority 3 — Nice-to-Haves (Days 10–12, if time permits)

- **RAG eval metrics**: Recall@K, nDCG — explain conceptually with an example
- **LangGraph / Agentic AI**: what an agent graph is, why testing agents is harder (multi-step, tool calls, state)
- **Vector DBs**: pgvector especially (pairs naturally with SQL work) — understand "similarity search" testing
- **Playwright**: only if the role has a UI component — basic locators/assertions
- **BFSI domain**: think data sensitivity, PII masking, audit trails — ties into "guardrails/security" answers

---

## Capstone Project — "NL2SQL Eval Harness"

A weekend project that lets you speak concretely to nearly every JD bullet.

```
nl2sql-eval/
├── golden_dataset.json       # 15-20 NL queries + gold SQL + expected result
├── nl2sql_client.py          # wraps an LLM call (OpenAI/Anthropic) to generate SQL
├── db/                       # SQLite db with a small realistic schema (orders, customers, etc.)
├── evaluators/
│   ├── execution_match.py    # runs generated vs gold SQL, compares result sets
│   ├── exact_match.py        # EM on normalized SQL text
│   └── metrics.py            # precision/recall/F1/MRR aggregation across dataset
├── test_nl2sql_regression.py # pytest suite, parametrized over golden dataset
└── tracing.py                # logs each run to Langfuse/LangSmith (free tier)
```

**Talking points this gives you:** golden dataset design, execution accuracy vs. exact match, pytest parametrization, tracing/observability, metrics computation, regression gating — essentially the entire JD in one demo you can screen-share.

---

## Interview-Day Framing

Reframe past project experience into this language, even if different tools were used:

| Old framing | AI QA framing |
|---|---|
| "Flaky test" | Non-deterministic output validation |
| "Test data" | Golden dataset |
| "Regression suite" | Prompt/model regression testing |

**Have 2–3 STAR stories ready:**
1. Catching a subtle bug via metrics (not just pass/fail)
2. Scaling a test automation framework
3. Handling non-determinism in a system

---

## Suggested Timeline

| Days | Focus |
|---|---|
| 1–3 | Priority 0: Python/Pytest, SQL, REST API testing |
| 3–7 | Priority 1: Eval fundamentals, metrics, golden datasets, regression testing |
| 7–10 | Priority 2: Pick one tracing tool, build hands-on familiarity |
| 10–12 | Priority 3 (if time): RAG metrics, agentic AI, vector DBs, BFSI framing |
| Ongoing | Build the capstone project in parallel; prep STAR stories |
