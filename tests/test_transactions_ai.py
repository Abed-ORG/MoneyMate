from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

import app.models  # noqa: F401
from app.auth import routes as auth_routes
from app.db import Base
from app.dependencies import get_db
from app.main import app
from app.schemas.transaction import AiCategorization


def _make_client(monkeypatch):
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()

    def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db
    monkeypatch.setattr(
        auth_routes,
        "send_password_reset_email",
        lambda *args, **kwargs: None,
    )

    client = TestClient(app)
    credentials = {
        "email": "ai-test@example.com",
        "password": "old-password",
    }
    registration = client.post(
        "/auth/register",
        json={**credentials, "full_name": "AI Test User"},
    )
    assert registration.status_code == 201
    login = client.post("/auth/login", json=credentials)
    assert login.status_code == 200
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    return client, session, headers


def test_category_management_and_ai_suggestion(monkeypatch):
    client, session, headers = _make_client(monkeypatch)
    monkeypatch.setattr(
        "app.repositories.transaction_repository.suggest_category",
        lambda request_data: AiCategorization(
            category="Transport",
            confidence=91,
            provider="gemini",
            rationale="Matched ride-hailing vendor.",
        ),
    )

    try:
        categories = client.get("/transactions/categories", headers=headers)
        assert categories.status_code == 200
        assert any(item["is_default"] for item in categories.json())

        created = client.post(
            "/transactions/categories",
            headers=headers,
            json={"name": "Fitness", "color": "#123456", "is_default": False},
        )
        assert created.status_code == 201
        category_id = created.json()["id"]

        updated = client.patch(
            f"/transactions/categories/{category_id}",
            headers=headers,
            json={"name": "Health & Fitness", "color": "#654321"},
        )
        assert updated.status_code == 200
        assert updated.json()["name"] == "Health & Fitness"

        deleted = client.delete(
            f"/transactions/categories/{category_id}",
            headers=headers,
        )
        assert deleted.status_code == 204

        suggestion = client.post(
            "/transactions/suggest",
            headers=headers,
            json={"amount": -18.5, "vendor": "Uber", "notes": "Ride home"},
        )
        assert suggestion.status_code == 200
        assert suggestion.json()["category"] == "Transport"
        assert suggestion.json()["provider"] == "gemini"
    finally:
        app.dependency_overrides.clear()
        session.close()


def test_correction_and_bulk_recategorization(monkeypatch):
    client, session, headers = _make_client(monkeypatch)
    monkeypatch.setattr(
        "app.repositories.transaction_repository.suggest_category",
        lambda request_data: AiCategorization(
            category="Food & Dining",
            confidence=88,
            provider="gemini",
            rationale="Food vendor detected.",
        ),
    )

    try:
        first = client.post(
            "/transactions",
            headers=headers,
            json={
                "date": "2026-06-18T12:00:00Z",
                "amount": -12.5,
                "category": "Food & Dining",
                "vendor": "Starbucks",
                "notes": "Latte",
            },
        )
        assert first.status_code == 201
        transaction_id = first.json()["id"]

        corrected = client.post(
            f"/transactions/{transaction_id}/correction",
            headers=headers,
            json={"category": "Transport"},
        )
        assert corrected.status_code == 200
        assert corrected.json()["category"] == "Transport"
        assert corrected.json()["ai_categorization"]["provider"] == "user"

        second = client.post(
            "/transactions",
            headers=headers,
            json={
                "date": "2026-06-18T13:00:00Z",
                "amount": -22.0,
                "category": "Food & Dining",
                "vendor": "Lyft",
                "notes": "Airport ride",
            },
        )
        assert second.status_code == 201

        bulk = client.post(
            "/transactions/bulk-recategorize",
            headers=headers,
            json={"transaction_ids": [transaction_id, second.json()["id"]]},
        )
        assert bulk.status_code == 200
        assert len(bulk.json()) == 2
    finally:
        app.dependency_overrides.clear()
        session.close()


def test_heuristic_ai_matches_typos_and_aliases(monkeypatch):
    client, session, headers = _make_client(monkeypatch)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    try:
        suggestion = client.post(
            "/transactions/suggest",
            headers=headers,
            json={"amount": -8.5, "vendor": "mcdo", "notes": "food"},
        )
        assert suggestion.status_code == 200
        assert suggestion.json()["category"] == "Food & Dining"
    finally:
        app.dependency_overrides.clear()
        session.close()
