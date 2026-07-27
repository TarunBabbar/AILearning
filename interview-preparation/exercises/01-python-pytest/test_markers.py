import pytest
import sys

# --- skip — always skips ---
@pytest.mark.skip(reason="demonstrating unconditional skip")
def test_will_skip():
    assert 1 == 2  # never runs

# --- skipif — skip on a condition ---
@pytest.mark.skipif(sys.platform != "win32", reason="only runs on Windows")
def test_windows_only():
    assert sys.platform == "win32"

# --- xfail — expected failure, doesn't count as FAIL ---
@pytest.mark.xfail(reason="known bug #42")
def test_known_failure():
    assert 1 == 2  # expected to fail → XFAIL in output

@pytest.mark.xfail(reason="this actually passes — XPASS")
def test_unexpected_pass():
    assert 1 == 1  # unexpected pass → XPASS (still flagged)
