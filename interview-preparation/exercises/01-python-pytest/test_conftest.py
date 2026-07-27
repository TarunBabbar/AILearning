def test_db_connection(shared_db):
    assert shared_db["connected"] is True

def test_db_host(shared_db):
    assert shared_db["host"] == "localhost"

def test_db_port(shared_db):
    assert shared_db["port"] == 1234