# Phase 6: Capstone — NL2SQL Eval Harness

**Status:** Not started yet  
**Goal:** A complete project you can screen-share in the interview

---

## Project Structure

```
nl2sql-eval/
├── golden_dataset.json        # 15-20 NL queries + gold SQL + expected result
├── db/
│   ├── schema.sql             # CREATE TABLE statements
│   └── seed.sql               # Sample data
├── src/
│   ├── nl2sql_client.py       # Wraps LLM call
│   ├── evaluator.py           # Execution match, exact match
│   └── metrics.py             # EM, precision, recall, F1
├── tests/
│   ├── test_evaluator.py      # Parametrized tests
│   └── test_regression.py     # CI gating
├── tracing.py                 # Langfuse integration
├── run_benchmark.py           # Full pipeline runner
├── pyproject.toml
└── README.md                  # Talking points
```

---

## Build Progress

- [ ] Scaffold project + DB schema
- [ ] evaluator.py (execution match, exact match)
- [ ] metrics.py (EM, precision, recall, F1)
- [ ] golden_dataset.json
- [ ] nl2sql_client.py (LLM integration)
- [ ] tests/ (parametrized pytest suite)
- [ ] tracing.py (Langfuse)
- [ ] run_benchmark.py + CI gate
- [ ] README.md interview talking points
