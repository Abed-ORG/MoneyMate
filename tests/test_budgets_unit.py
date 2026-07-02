"""Unit tests for budget endpoints.

Covers create, update, delete, list budgets and edge cases like
validation errors, unauthorized access, and invalid input.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

import app.models  # noqa: F401
from app.auth.services import create_user
from app.auth import routes as auth_routes
from app.db import Base
from app.dependencies import get_db
from app.main import app
from app.models.financial_profile import FinancialProfile
from app.schemas.user import UserCreate


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
    return client, session


def _cleanup():
    app.dependency_overrides.clear()


def _register_and_login(client, email="budget@example.com", password="password123"):
    reg = client.post(
        "/auth/register",
        json={"full_name": "Budget User", "email": email, "password": password},
    )
    assert reg.status_code == 201
    login = client.post("/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def _ensure_profile(session, email):
    from app.models.user import User

    user = session.query(User).filter_by(email=email).first()
    if not user.financial_profile:
        profile = FinancialProfile(user_id=user.id)
        session.add(profile)
        session.commit()
    user.financial_profile.spending_categories = ["Food & Dining", "Shopping", "Healthcare"]
    session.commit()


def test_create_budget_success(monkeypatch):
    client, session = _make_client(monkeypatch)
    try:
        headers = _register_and_login(client)
        _ensure_profile(session, "budget@example.com")

        categories = client.get("/budgets/categories", headers=headers)
        assert categories.status_code == 200
        food = next(
            item for item in categories.json() if item["name"] == "Food & Dining"
        )

        response = client.post(
            "/budgets",
            headers=headers,
            json={
                "category_id": food["id"],
                "amount": 150.00,
                "month": 6,
                "year": 2026,
            },
        )
        assert response.status_code == 201
        assert float(response.json()["amount"]) == 150.0
        assert response.json()["category_id"] == food["id"]
    finally:
        _cleanup()
        session.close()


def test_create_budget_unauthorized(monkeypatch):
    client, session = _make_client(monkeypatch)
    try:
        response = client.post(
            "/budgets",
            json={"category_id": 1, "amount": 100, "month": 6, "year": 2026},
        )
        assert response.status_code == 401
    finally:
        _cleanup()
        session.close()


def test_create_budget_invalid_amount(monkeypatch):
    client, session = _make_client(monkeypatch)
    try:
        headers = _register_and_login(client)
        _ensure_profile(session, "budget@example.com")

        response = client.post(
            "/budgets",
            headers=headers,
            json={"category_id": 1, "amount": "invalid", "month": 6, "year": 2026},
        )
        assert response.status_code == 422
    finally:
        _cleanup()
        session.close()


def test_create_budget_missing_fields(monkeypatch):
    client, session = _make_client(monkeypatch)
    try:
        headers = _register_and_login(client)
        response = client.post("/budgets", headers=headers, json={})
        assert response.status_code == 422
    finally:
        _cleanup()
        session.close()


def test_get_budget_success(monkeypatch):
    client, session = _make_client(monkeypatch)
    try:
        headers = _register_and_login(client)
        _ensure_profile(session, "budget@example.com")

        categories = client.get("/budgets/categories", headers=headers).json()
        food_id = next(item["id"] for item in categories if item["name"] == "Food & Dining")

        created = client.post(
            "/budgets",
            headers=headers,
            json={"category_id": food_id, "amount": 200, "month": 6, "year": 2026},
        )
        assert created.status_code == 201
        budget_id = created.json()["id"]

        response = client.get(f"/budgets/{budget_id}", headers=headers)
        assert response.status_code == 200
        assert response.json()["id"] == budget_id
    finally:
        _cleanup()
        session.close()


def test_get_budget_not_found(monkeypatch):
    client, session = _make_client(monkeypatch)
    try:
        headers = _register_and_login(client)
        response = client.get("/budgets/999999", headers=headers)
        assert response.status_code == 404
    finally:
        _cleanup()
        session.close()


def test_update_budget_success(monkeypatch):
    client, session = _make_client(monkeypatch)
    try:
        headers = _register_and_login(client)
        _ensure_profile(session, "budget@example.com")

        categories = client.get("/budgets/categories", headers=headers).json()
        food_id = next(item["id"] for item in categories if item["name"] == "Food & Dining")

        created = client.post(
            "/budgets",
            headers=headers,
            json={"category_id": food_id, "amount": 100, "month": 6, "year": 2026},
        )
        budget_id = created.json()["id"]

        response = client.patch(
            f"/budgets/{budget_id}",
            headers=headers,
            json={"amount": 250},
        )
        assert response.status_code == 200
        assert float(response.json()["amount"]) == 250.0
    finally:
        _cleanup()
        session.close()


def test_update_budget_not_found(monkeypatch):
    client, session = _make_client(monkeypatch)
    try:
        headers = _register_and_login(client)
        response = client.patch("/budgets/999999", headers=headers, json={"amount": 200})
        assert response.status_code == 404
    finally:
        _cleanup()
        session.close()


def test_delete_budget_success(monkeypatch):
    client, session = _make_client(monkeypatch)
    try:
        headers = _register_and_login(client)
        _ensure_profile(session, "budget@example.com")

        categories = client.get("/budgets/categories", headers=headers).json()
        food_id = next(item["id"] for item in categories if item["name"] == "Food & Dining")

        created = client.post(
            "/budgets",
            headers=headers,
            json={"category_id": food_id, "amount": 100, "month": 6, "year": 2026},
        )
        budget_id = created.json()["id"]

        response = client.delete(f"/budgets/{budget_id}", headers=headers)
        assert response.status_code == 204

        again = client.get(f"/budgets/{budget_id}", headers=headers)
        assert again.status_code == 404
    finally:
        _cleanup()
        session.close()


def test_delete_budget_not_found(monkeypatch):
    client, session = _make_client(monkeypatch)
    try:
        headers = _register_and_login(client)
        response = client.delete("/budgets/999999", headers=headers)
        assert response.status_code == 404
    finally:
        _cleanup()
        session.close()


def test_list_budgets_success(monkeypatch):
    client, session = _make_client(monkeypatch)
    try:
        headers = _register_and_login(client)
        _ensure_profile(session, "budget@example.com")

        categories = client.get("/budgets/categories", headers=headers).json()
        food_id = next(item["id"] for item in categories if item["name"] == "Food & Dining")

        client.post(
            "/budgets",
            headers=headers,
            json={"category_id": food_id, "amount": 100, "month": 6, "year": 2026},
        )

        response = client.get("/budgets", headers=headers)
        assert response.status_code == 200
        assert len(response.json()) >= 1
    finally:
        _cleanup()
        session.close()


def test_budget_other_user_isolation(monkeypatch):
    client, session = _make_client(monkeypatch)
    try:
        headers1 = _register_and_login(client, email="b1@example.com")
        headers2 = _register_and_login(client, email="b2@example.com")

        _ensure_profile(session, "b1@example.com")
        _ensure_profile(session, "b2@example.com")

        categories1 = client.get("/budgets/categories", headers=headers1).json()
        food_id1 = next(item["id"] for item in categories1 if item["name"] == "Food & Dining")

        created = client.post(
            "/budgets",
            headers=headers1,
            json={"category_id": food_id1, "amount": 100, "month": 6, "year": 2026},
        )
        budget_id = created.json()["id"]

        cross = client.get(f"/budgets/{budget_id}", headers=headers2)
        assert cross.status_code == 404
    finally:
        _cleanup()
        session.close()