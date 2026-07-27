# Phase 1: Python & Pytest

**Status:** Complete — all Phase 1 topics done  
**Goal:** Write production-quality tests (parametrized, fixtures, conftest, plugins)

---

## Topics Covered

- [x] Virtual environment setup (`python -m venv .venv`)
- [x] Pip install (pytest, pandas, requests)
- [x] Pytest basics: assert, runners, exit codes
- [x] `@pytest.mark.parametrize` — what it is, why it matters for NL2SQL eval
- [x] `@pytest.fixture` — what it is, why it matters for NL2SQL eval
- [x] Fixture scopes: `function` (default) vs `session` with `yield` teardown
- [x] `conftest.py` — shared fixture auto-discovered by all tests in the directory
- [x] Markers: built-in (skip, skipif, xfail) + custom (smoke, slow, regression)
- [x] `pytest.ini` — register markers, set defaults, strict mode
- [x] Plugins: pytest-xdist (parallel -n), pytest-html (reporting), pytest-cov (coverage)

---

## Key Code / Snippets

### parametrize — run one test with many inputs

```python
@pytest.mark.parametrize("a, b, expected", [
    (1, 2, 3),
    (0, 0, 0),
    (-1, 1, 0),
    (100, 200, 300),
])
def test_add(a, b, expected):
    assert a + b == expected
```

**Without parametrize:** you'd write 4 copy-pasted tests.  
**With parametrize:** one test, pytest runs it once per row.  
**Why for NL2SQL:** golden dataset with 20 queries = one parametrized test over the dataset.

### fixture with session scope + yield teardown

```python
@pytest.fixture(scope="session")
def per_session_data():
    print("\n [SETUP] session created once")
    yield {"db": "connected"}
    print("\n[TEARDOWN] session destroyed once")
```

**session scope:** fixture created once per test run, not once per test.  
**yield:** what comes before yield = setup, what comes after = teardown.  
**Why for NL2SQL:** set up a test DB once, all tests share it, tear down after the last test.

---

## Exercises Completed

### `exercises/01-python-pytest/`

| File | What it taught |
|------|---------------|
| `test_basic.py` | Basic asserts (`1+1==2`, `"hello".upper()`) |
| `test_param.py` | `@pytest.mark.parametrize` with 5 addition cases + fixture injection |
| `test_conftest.py` | 3 tests that consume `shared_db` fixture from `conftest.py` |
| `test_scopes.py` | `function` vs `session` scope with `yield` teardown |
| `test_exercise.py` | Combined parametrize + fixture; catch failure case (`-1` raises) |
| `conftest.py` | `shared_db` fixture with `session` scope, auto-discovered |

### What we proved by running

- `pytest` discovers `conftest.py` automatically — no imports needed
- A `session`-scoped fixture in `conftest.py` is created once and shared across ALL test files in the directory
- `function`-scoped fixtures are created fresh per test
- `yield` lets you run cleanup after the test (teardown)
- Parametrize + fixture = the pattern for NL2SQL eval (one test, many queries, shared DB)
- The `test_exercise.py` parametrized case caught `-1` as a failure — real validation in action

---

## Markers & pytest.ini (`exercises/01-python-pytest/`)

### Built-in markers

| Marker | Effect | Output |
|--------|--------|--------|
| `@pytest.mark.skip` | Always skip | `s` / SKIPPED |
| `@pytest.mark.skipif(condition)` | Skip conditionally | `s` / SKIPPED |
| `@pytest.mark.xfail(reason="...")` | Expected to fail — **not** a FAIL | `x` / XFAIL |
| `@pytest.mark.xfail(strict=True)` | Unexpected pass becomes a FAIL | `X` / XPASS (warns) |

### Custom markers (registered in `pytest.ini`)

```ini
markers =
    smoke: quick smoke test verifying core functionality
    slow: test that takes noticeable time, excluded by default
    regression: tests that validate against known-good baselines
```

### Running by marker

```bash
pytest -m smoke           # only smoke tests
pytest -m "not slow"      # everything except slow
pytest -m "smoke and regression"  # tests with BOTH markers
```

### `pytest.ini`

```ini
[pytest]
markers = smoke slow regression
addopts = -v --strict-markers
python_files = test_*.py
python_classes = Test*
python_functions = test_*
```

**`--strict-markers`** — catches typos like `@pytest.mark.smokee` at collection time instead of silently ignoring them.

---

## Plugins

| Plugin | Flag | What it does |
|--------|------|-------------|
| `pytest-xdist` | `-n <workers>` | Runs tests in parallel across N workers |
| `pytest-html` | `--html=report.html` | Generates a self-contained HTML report |
| `pytest-cov` | `--cov` | Measures code coverage (which lines did tests exercise) |

```bash
# Run 3 test files in parallel with 2 workers, coverage, and an HTML report
pytest test_a.py test_b.py test_c.py -n 2 --cov --html=report.html
```

### New exercise files

| File | What it taught |
|------|---------------|
| `test_markers.py` | Built-in markers: `skip`, `skipif`, `xfail`, `xpass` |
| `test_markers_custom.py` | Custom markers `smoke`, `slow`, `regression` with `-m` filtering |
| `pytest.ini` | Project-level config: marker registry, strict mode, discovery patterns |

### fixture — set up data once, use in many tests

```python
@pytest.fixture
def sample_data():
    return {"name": "Alice", "score": 95}

def test_alice_score(sample_data):
    assert sample_data["score"] > 90

def test_alice_name(sample_data):
    assert sample_data["name"] == "Alice"
```

**Without fixture:** each test creates the data itself (duplication).  
**With fixture:** one place to define it, pytest injects it into any test that asks for it.  
**Why for NL2SQL:** create a SQLite DB fixture once, every test uses the same DB.

---

## Notes & Gotchas

- One venv per project root, not per subfolder. Activate from subfolder by giving the relative path: `..\..\.venv\Scripts\Activate`
- `-v` flag = verbose output (shows each test name)
- `pytest` auto-discovers files matching `test_*.py` or `*_test.py`
- Fixture function name becomes the parameter name in the test
