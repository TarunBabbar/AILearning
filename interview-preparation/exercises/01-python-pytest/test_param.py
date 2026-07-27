import pytest
@pytest.mark.parametrize("a,b,expected", [
    (1,2,3),
    (2,3,5),
    (3,4,7),
    (0,0,0),
    (100,200,300)
])

def test_add(a, b, expected):
    assert a + b == expected

@pytest.fixture
def sample_data():
    return {"name": "Alice", "score": 95}

def test_fixture_usage(sample_data):
    assert sample_data["name"] == "Alice"
    assert sample_data["score"] == 95
