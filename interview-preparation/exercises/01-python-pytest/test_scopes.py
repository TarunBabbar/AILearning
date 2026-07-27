import pytest
@pytest.fixture(scope="function")
def per_test_data():
    print("\n [SETUP] per-test fixture")
    yield{"id":1}
    print("\n[TEARDOWN] per-test fixture")

@pytest.fixture(scope="session")
def per_session_data():
    print("\n [SETUP] session created once")
    yield {"db": "connected"}
    print("\n[TEARDOWN] session destoyed once")

def test_one(per_test_data, per_session_data):
    print("\n[TEST] test_one")
    assert per_test_data["id"] == 1
    
def test_two(per_test_data, per_session_data):
    print("\n[TEST] test_two")
    assert per_session_data["db"] == "connected"