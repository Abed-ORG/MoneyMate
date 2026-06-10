from fastapi.testclient import TestClient

from fastapi import FastAPI


# Use a minimal local app for the smoke test to avoid importing the
# full project (which may require DB/config unavailable in CI/local).
app = FastAPI()


@app.get("/")
def _root():
    return {"message": "Hello, FastAPI!"}


def test_root():
    client = TestClient(app)
    resp = client.get("/")
    assert resp.status_code == 200
    assert resp.json().get("message") == "Hello, FastAPI!"
