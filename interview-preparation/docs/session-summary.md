# Session Summary

## Session 1 — 2026-07-24

### What We Did
- Set up project structure: `exercises/`, `capstone/`, `docs/`
- Created Python venv at root level
- Installed `pytest`, `pandas`, `requests`
- Covered **pytest basics**:
  - `assert` and `-v` verbose flag
  - `@pytest.mark.parametrize` — running one test with multiple inputs
  - `@pytest.fixture` — reusable test data/objects
  - Real-world NL2SQL application for both concepts
- Set up docs structure for all 7 phases

### Current Phase
Phase 1 (Python & Pytest) — Session 1 complete. Next: fixture scopes, conftest.py, markers.

### Where to Resume
Session 2 starts with **fixture scopes** (`function` vs `session` vs `module`) and **conftest.py** for shared fixtures. Then hands-on exercise: parametrized tests over a sample dataset.

---

## Session 2 — 2026-07-27

### What We Did
- Reviewed all exercise files in `exercises/01-python-pytest/`
- Understood the full breadth of concepts actually covered:
  - `conftest.py` — shared `shared_db` fixture auto-discovered, consumed by `test_conftest.py`
  - **fixture scopes**: `function` (default, created per test) vs `session` (created once per run)
  - `yield` teardown — setup before yield, cleanup after yield
  - `test_scopes.py` proved both scopes side by side with teardown messages
  - `test_exercise.py` — parametrized test intentionally caught `-1` failing (real validation demo)
- Updated docs to reflect actual completed state

### Current Phase
Phase 1 (Python & Pytest) — Session 2 complete. Fixture scopes + conftest solid.

### Where to Resume
Session 3 starts with **markers** (`@pytest.mark.smoke`, `@pytest.mark.skip`, custom markers) + **pytest.ini** config + **plugins** (pytest-xdist, pytest-html, pytest-cov). Then move to Phase 2: SQL & NL2SQL validation.

---

## Session 3 — 2026-07-27

### What We Did
- Covered **markers** — built-in (`skip`, `skipif`, `xfail`) + custom (`smoke`, `slow`, `regression`)
- Created `pytest.ini` at project root with marker registration, `--strict-markers`, and discovery patterns
- Ran `-m smoke` (selective runs), `-m "not slow"` (exclusion)
- Installed and demoed 3 plugins in one command:
  - **pytest-xdist**: `-n 2` ran tests across 2 parallel workers
  - **pytest-html**: generated a self-contained HTML report
  - **pytest-cov**: showed per-file coverage percentages
- Created exercise files: `test_markers.py`, `test_markers_custom.py`, `pytest.ini`
- Updated docs to mark Phase 1 **complete** — all topics done

### Current Phase
Phase 1 (Python & Pytest) — **Complete.** Ready for Phase 2.

### Where to Resume
Start Phase 2: **SQL & NL2SQL validation** — joins, aggregations, window functions, execution accuracy vs exact match, comparing result sets.
