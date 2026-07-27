import pytest

@pytest.fixture(scope="session")
def shared_db():
    print("\n [CONFTEST] Setting up database connection")
    return {"host":"localhost","port":1234,"connected": True}
