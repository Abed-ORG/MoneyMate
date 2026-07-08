from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.auth import routes as auth_routes
from app.db import Base
from app.dependencies import get_db
from app.main import app
from app.repositories.transaction_repository import transaction_repository
from app.schemas.transaction import AiCategorization


def test_register_login_create_update_and_delete_transaction(monkeypatch):
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
    monkeypatch.setattr(transaction_repository, "_transactions", [])
    monkeypatch.setattr(
        "app.repositories.transaction_repository.suggest_category",
        lambda request_data: AiCategorization(
            category="Food & Dining",
            confidence=95,
            provider="test",
            rationale="Deterministic test categorization.",
        ),
    )

    try:
        client = TestClient(app)
        credentials = {
            "email": "workflow@example.com",
            "password": "password-123",
        }

        registration = client.post(
            "/auth/register",
            json={**credentials, "full_name": "Workflow User"},
        )
        assert registration.status_code == 201

        login = client.post("/auth/login", json=credentials)
        assert login.status_code == 200
        headers = {
            "Authorization": f"Bearer {login.json()['access_token']}",
        }

        created = client.post(
            "/transactions",
            headers=headers,
            json={
                "date": "2026-07-08T12:00:00Z",
                "amount": -24.5,
                "category": "Food & Dining",
                "vendor": "Cafe Demo",
                "notes": "Lunch",
            },
        )
        assert created.status_code == 201
        transaction_id = created.json()["id"]

        listed = client.get("/transactions?search=Cafe", headers=headers)
        assert listed.status_code == 200
        assert listed.json()["total"] == 1
        assert listed.json()["items"][0]["id"] == transaction_id

        updated = client.patch(
            f"/transactions/{transaction_id}",
            headers=headers,
            json={"notes": "Lunch with team", "amount": -26.75},
        )
        assert updated.status_code == 200
        assert updated.json()["notes"] == "Lunch with team"
        assert updated.json()["history"]

        deleted = client.delete(
            f"/transactions/{transaction_id}",
            headers=headers,
        )
        assert deleted.status_code == 204

        empty = client.get("/transactions", headers=headers)
        assert empty.status_code == 200
        assert empty.json()["total"] == 0
    finally:
        app.dependency_overrides.clear()
        session.close()
