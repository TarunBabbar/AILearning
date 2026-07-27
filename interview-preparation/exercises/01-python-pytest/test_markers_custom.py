import pytest

@pytest.mark.smoke
def test_sanity_check():
    """Marker: smoke — run this to verify the test harness works."""
    assert 1 + 1 == 2

@pytest.mark.smoke
def test_db_connect():
    """Marker: smoke — basic connectivity."""
    assert True

@pytest.mark.slow
def test_heavy_computation():
    """Marker: slow — imagine this takes 30s."""
    result = sum(range(1_000_000))
    assert result > 0

@pytest.mark.regression
def test_known_feature_still_works():
    """Marker: regression — guard against regressions."""
    assert "hello".upper() == "HELLO"

@pytest.mark.smoke
@pytest.mark.regression
def test_smoke_and_regression():
    """Multiple markers on one test."""
    assert "True".lower() =="true"

@pytest.mark.skip(reason="Demonstrating skipping a test.")
def test_skipped():
    """This test is skipped."""
    assert 1==2

@pytest.mark.xfail(reason="Demonstrating expected failure.")
def test_expected_failure():
    assert 1==3

@pytest.mark.xfail(reason="Demonstrating unexpected pass.")
def test_unexpected_pass():
    assert 1==1