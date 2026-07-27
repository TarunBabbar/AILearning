# Phase 1: Python & Pytest

**Status:** In progress — Session 2 complete  
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
- [ ] Markers and pytest.ini
- [ ] Plugins: xdist, html, cov

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
