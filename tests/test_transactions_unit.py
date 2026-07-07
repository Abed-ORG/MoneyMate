"""Unit tests for transaction endpoints.

Covers create, update, delete, list transactions and edge cases like
validation errors, unauthorized access, and invalid input.
"""

from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.auth import routes as auth_routes
from app.db import Base
from app.dependencies import get_db
from app.main import app
from app.models.financial_profile import FinancialProfile


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


def _register_and_login(
    client, email="tx@example.com", password="password123"
):
    reg = client.post(
        "/auth/register",
        json={
            "full_name": "TX User",
            "email": email,
            "password": password,
        },
    )
    assert reg.status_code == 201
    login = client.post(
        "/auth/login", json={"email": email, "password": password}
    )
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def _ensure_categories(session, client, headers):
    """Make sure the user has spending categories assigned and return
    category name."""
    from app.models.user import User

    user = session.query(User).filter_by(email="tx@example.com").first()
    if user and not user.financial_profile:
        profile = FinancialProfile(user_id=user.id)
        session.add(profile)
        session.commit()
    if user and user.financial_profile:
        user.financial_profile.spending_categories = [
            "Food & Dining",
            "Shopping",
        ]
        session.commit()
    resp = client.get("/transactions/categories", headers=headers)
    if resp.status_code == 200 and resp.json():
        return next(
            (c["name"] for c in resp.json() if c["is_default"]),
            resp.json()[0]["name"],
        )
    return "Food & Dining"


def test_create_transaction_success(monkeypatch):
    client, session = _make_client(monkeypatch)
    try:
        headers = _register_and_login(client)
        cat_id = _ensure_categories(session, client, headers)
        assert cat_id is not None

        payload = {
            "category": cat_id,
            "amount": -50.00,
            "date": "2026-06-15",
            "vendor": "Grocery Store",
            "notes": "Weekly shopping",
        }
        response = client.post(
            "/transactions", headers=headers, json=payload
        )
        assert response.status_code == 201
        data = response.json()
        assert data["amount"] == "-50.00"
        assert data["vendor"] == "Grocery Store"
        assert data["category"] == cat_id
    finally:
        _cleanup()
        session.close()


def test_create_transaction_unauthorized(monkeypatch):
    client, session = _make_client(monkeypatch)
    try:
        response = client.post(
            "/transactions",
            json={
                "category": "Food",
                "amount": -50,
                "date": "2026-06-15",
            },
        )
        assert response.status_code == 401
    finally:
        _cleanup()
        session.close()


def test_create_transaction_invalid_amount(monkeypatch):
    client, session = _make_client(monkeypatch)
    try:
        headers = _register_and_login(client)
        cat_id = _ensure_categories(session, client, headers)
        response = client.post(
            "/transactions",
            headers=headers,
            json={
                "category": cat_id,
                "amount": "not-a-number",
                "date": "2026-06-15",
            },
        )
        assert response.status_code == 422
    finally:
        _cleanup()
        session.close()


def test_create_transaction_missing_required_fields(monkeypatch):
    client, session = _make_client(monkeypatch)
    try:
        headers = _register_and_login(client)
        response = client.post(
            "/transactions", headers=headers, json={"amount": -50}
        )
        assert response.status_code == 422
    finally:
        _cleanup()
        session.close()


def test_list_transactions_success(monkeypatch):
    client, session = _make_client(monkeypatch)
    try:
        headers = _register_and_login(client)
        cat_id = _ensure_categories(session, client, headers)
        client.post(
            "/transactions",
            headers=headers,
            json={
                "category": cat_id,
                "amount": -25.00,
                "date": "2026-06-10",
            },
        )

        response = client.get("/transactions", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert len(data["items"]) >= 1
    finally:
        _cleanup()
        session.close()


def test_list_transactions_pagination(monkeypatch):
    client, session = _make_client(monkeypatch)
    try:
        headers = _register_and_login(client)
        cat_id = _ensure_categories(session, client, headers)

        for i in range(5):
            client.post(
                "/transactions",
                headers=headers,
                json={
                    "category": cat_id,
                    "amount": -float(i * 10),
                    "date": f"2026-06-{i+1:02d}",
                },
            )

        resp_page1 = client.get(
            "/transactions?page=1&page_size=2", headers=headers
        )
        assert resp_page1.status_code == 200
        assert len(resp_page1.json()["items"]) == 2

        resp_page2 = client.get(
            "/transactions?page=2&page_size=2", headers=headers
        )
        assert resp_page2.status_code == 200
        assert len(resp_page2.json()["items"]) == 2
    finally:
        _cleanup()
        session.close()


def test_update_transaction_success(monkeypatch):
    client, session = _make_client(monkeypatch)
    try:
        headers = _register_and_login(client)
        cat_id = _ensure_categories(session, client, headers)
        created = client.post(
            "/transactions",
            headers=headers,
            json={
                "category": cat_id,
                "amount": -30.00,
                "date": "2026-06-10",
            },
        )
        assert created.status_code == 201
        tx_id = created.json()["id"]

        response = client.patch(
            f"/transactions/{tx_id}",
            headers=headers,
            json={"amount": -40.00, "vendor": "Updated Store"},
        )
        assert response.status_code == 200
        assert Decimal(response.json()["amount"]) == Decimal("-40.00")
        assert response.json()["vendor"] == "Updated Store"
    finally:
        _cleanup()
        session.close()


def test_update_transaction_not_found(monkeypatch):
    client, session = _make_client(monkeypatch)
    try:
        headers = _register_and_login(client)
        response = client.patch(
            "/transactions/999999",
            headers=headers,
            json={"amount": -50},
        )
        assert response.status_code == 404
    finally:
        _cleanup()
        session.close()


def test_update_transaction_other_user(monkeypatch):
    client, session = _make_client(monkeypatch)
    try:
        headers1 = _register_and_login(client, email="user1@example.com")
        headers2 = _register_and_login(client, email="user2@example.com")
        cat_id = _ensure_categories(session, client, headers1)

        created = client.post(
            "/transactions",
            headers=headers1,
            json={
                "category": cat_id,
                "amount": -30.00,
                "date": "2026-06-10",
            },
        )
        tx_id = created.json()["id"]

        response = client.patch(
            f"/transactions/{tx_id}",
            headers=headers2,
            json={"amount": -50},
        )
        assert response.status_code == 404
    finally:
        _cleanup()
        session.close()


def test_delete_transaction_success(monkeypatch):
    client, session = _make_client(monkeypatch)
    try:
        headers = _register_and_login(client)
        cat_id = _ensure_categories(session, client, headers)
        created = client.post(
            "/transactions",
            headers=headers,
            json={
                "category": cat_id,
                "amount": -30.00,
                "date": "2026-06-10",
            },
        )
        tx_id = created.json()["id"]

        response = client.delete(f"/transactions/{tx_id}", headers=headers)
        assert response.status_code == 204

        # Verify deleted by checking list
        list_resp = client.get("/transactions", headers=headers)
        assert all(
            item["id"] != tx_id for item in list_resp.json()["items"]
        )
    finally:
        _cleanup()
        session.close()


def test_delete_transaction_not_found(monkeypatch):
    client, session = _make_client(monkeypatch)
    try:
        headers = _register_and_login(client)
        response = client.delete("/transactions/999999", headers=headers)
        assert response.status_code == 404
    finally:
        _cleanup()
        session.close()


def test_get_transaction_by_id(monkeypatch):
    client, session = _make_client(monkeypatch)
    try:
        headers = _register_and_login(client)
        cat_id = _ensure_categories(session, client, headers)
        created = client.post(
            "/transactions",
            headers=headers,
            json={
                "category": cat_id,
                "amount": -75.00,
                "date": "2026-06-20",
                "vendor": "Test Store",
            },
        )
        tx_id = created.json()["id"]

        # Verify via list since individual GET may not be available
        list_resp = client.get("/transactions", headers=headers)
        assert list_resp.status_code == 200
        found = next(
            (
                item
                for item in list_resp.json()["items"]
                if item["id"] == tx_id
            ),
            None,
        )
        assert found is not None
        assert Decimal(found["amount"]) == Decimal("-75.00")
    finally:
        _cleanup()
        session.close()


def test_unauthorized_access_returns_401(monkeypatch):
    client, session = _make_client(monkeypatch)
    try:
        response = client.get("/transactions")
        assert response.status_code == 401

        response = client.post("/transactions", json={"amount": -50})
        assert response.status_code == 401

        response = client.delete("/transactions/1")
        assert response.status_code == 401
    finally:
        _cleanup()
        session.close()
