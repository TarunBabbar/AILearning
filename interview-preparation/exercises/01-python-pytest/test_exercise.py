import pytest

@pytest.fixture(scope="session")
def list_of_numbers():
    return[1,2,3,4,5]

def test_positive_numbers(list_of_numbers):
    for num in list_of_numbers:
        assert num > 0

@pytest.mark.parametrize("number",[1,2,3,4,-1])
def test_parametrized_numbers(number):
    assert number > 0, f"Number {number} is not positive"
    
    