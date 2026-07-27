# AI QA Engineer (NL2SQL) — Learning Docs

**Your living reference.** Every concept, code snippet, SQL query, and interview tip we cover together is recorded here. Use this to revise before the interview.

---

## How This Works

- Each topic area has its own folder with notes and code examples
- When we finish a session, I update the relevant files
- You can search this whole folder to find anything we covered

---

## Table of Contents

| Folder | Phase | Topic |
|--------|-------|-------|
| `01-python-pytest/` | Phase 1 | Python fundamentals + Pytest mastery |
| `02-sql-nl2sql/` | Phase 2 | SQL (joins, windows, CTEs) + NL2SQL validation |
| `03-rest-api-testing/` | Phase 3 | REST API testing with requests, pydantic, mocking |
| `04-ai-eval/` | Phase 4 | LLM eval, metrics, golden datasets, prompt regression |
| `05-tracing/` | Phase 5 | Langfuse / LangSmith observability |
| `06-capstone/` | Phase 6 | NL2SQL Eval Harness project |
| `07-interview-prep/` | Phase 7 | Mock interviews, STAR stories, framing |

---

## Cheatsheet — Key NL2SQL Eval Concepts

_(Will be updated as we go)_

| Concept | One-liner |
|---------|-----------|
| Execution Accuracy | Run generated SQL + gold SQL, compare result sets |
| Exact Match (EM) | Compare normalized SQL text |
| Semantic Match | Different SQL, same data |
| LLM-as-Judge | Use an LLM to rate another LLM's output |
| Golden Dataset | Curated NL + SQL + expected results |
| Regression Gating | Block deploy if eval score drops below threshold |

---

## Quick Links

- [Master Learning Plan](../AI_QA_Interview_Prep_Plan.md) — the original plan file
- [Phase 1: Python & Pytest](./01-python-pytest/)
- [Phase 2: SQL & NL2SQL](./02-sql-nl2sql/)
- [Phase 3: REST API Testing](./03-rest-api-testing/)
- [Phase 4: AI Evaluation](./04-ai-eval/)
- [Phase 5: Tracing & Observability](./05-tracing/)
- [Phase 6: Capstone Project](./06-capstone/)
- [Phase 7: Interview Prep](./07-interview-prep/)
