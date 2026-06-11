from fastapi.testclient import TestClient

from app.main import app


def test_root():
    client = TestClient(app)
    resp = client.get("/")
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, dict)
    assert "message" in body
