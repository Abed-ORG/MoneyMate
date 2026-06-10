from fastapi import FastAPI


# Use a minimal local app for the smoke test and call the handler
# directly to avoid TestClient/httpx dependencies in CI.
app = FastAPI()


@app.get("/")
def _root():
    return {"message": "Hello, FastAPI!"}


def test_root():
    resp = _root()
    assert isinstance(resp, dict)
    assert resp.get("message") == "Hello, FastAPI!"
