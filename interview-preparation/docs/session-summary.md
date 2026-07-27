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

### Docs Created
- `docs/README.md` — master index
- `docs/01-python-pytest/README.md` — Phase 1 notes
- `docs/02-sql-nl2sql/README.md` — Phase 2 notes (empty, ready)
- `docs/03-rest-api-testing/README.md` — Phase 3 notes (empty)
- `docs/04-ai-eval/README.md` — Phase 4 notes (empty)
- `docs/05-tracing/README.md` — Phase 5 notes (empty)
- `docs/06-capstone/README.md` — Phase 6 notes (empty, has build progress checklist)
- `docs/07-interview-prep/README.md` — Phase 7 notes (empty)
- `docs/session-summary.md` — this file
