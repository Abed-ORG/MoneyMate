"""Integration tests covering complete user workflows.

Tests the full lifecycle: Register -> Login -> Create Transaction ->
Create Budget -> View Reports.
"""

from datetime import datetime, timezone
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


def _register(client, email, password, full_name="Integration User"):
    resp = client.post(
        "/auth/register",
        json={"full_name": full_name, "email": email, "password": password},
    )
    assert resp.status_code == 201, f"Registration failed: {resp.text}"
    return resp.json()


def _login(client, email, password):
    resp = client.post("/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json()["access_token"]


def _setup_user(client, session, email="integration@example.com", password="password123"):
    """Register, login, and set up profile with categories."""
    _register(client, email, password)
    token = _login(client, email, password)
    headers = {"Authorization": f"Bearer {token}"}

    from app.models.user import User

    user = session.query(User).filter_by(email=email).first()
    if not user.financial_profile:
        profile = FinancialProfile(user_id=user.id)
        session.add(profile)
        session.commit()
    user.financial_profile.spending_categories = [
        "Food & Dining",
        "Shopping",
        "Transportation",
        "Healthcare",
    ]
    session.commit()

    return headers, user


def test_full_user_lifecycle(monkeypatch):
    """Register → Login → Create Transaction → Create Budget → View Data."""
    client, session = _make_client(monkeypatch)
    try:
        headers, user = _setup_user(client, session)

        # Get categories
        cat_resp = client.get("/transactions/categories", headers=headers)
        assert cat_resp.status_code == 200
        categories = cat_resp.json()
        assert len(categories) > 0
        food_cat = next(c for c in categories if c["name"] == "Food & Dining")

        # Create transaction
        tx_resp = client.post(
            "/transactions",
            headers=headers,
            json={
                "category": food_cat["name"],
                "amount": -85.50,
                "date": "2026-06-15",
                "vendor": "Supermarket",
                "notes": "Weekly groceries",
            },
        )
        assert tx_resp.status_code == 201
        tx = tx_resp.json()
        assert tx["amount"] == "-85.50"
        assert tx["vendor"] == "Supermarket"
        tx_id = tx["id"]

        # List transactions and verify the created transaction is present
        list_tx = client.get("/transactions", headers=headers)
        assert list_tx.status_code == 200
        assert len(list_tx.json()["items"]) == 1
        assert list_tx.json()["items"][0]["id"] == tx_id

        # Update transaction
        update_resp = client.patch(
            f"/transactions/{tx_id}",
            headers=headers,
            json={"amount": -95.00, "notes": "Updated groceries"},
        )
        assert update_resp.status_code == 200
        assert Decimal(update_resp.json()["amount"]) == Decimal("-95.00")

        # Create budget
        budget_resp = client.post(
            "/budgets",
            headers=headers,
            json={
                "category_id": food_cat["id"],
                "amount": 200.00,
                "month": 6,
                "year": 2026,
            },
        )
        assert budget_resp.status_code == 201
        budget = budget_resp.json()
        assert float(budget["amount"]) == 200.0
        budget_id = budget["id"]

        # Get budget
        get_budget = client.get(f"/budgets/{budget_id}", headers=headers)
        assert get_budget.status_code == 200

        # Budget overview includes transaction spending
        overview = client.get(
            "/budgets/overview?month=6&year=2026", headers=headers
        )
        assert overview.status_code == 200
        assert len(overview.json()["budgets"]) >= 1
        budget_summary = overview.json()["budgets"][0]
        assert Decimal(str(budget_summary["actual_spending"])) == Decimal("95.00")

        # List budgets
        list_budgets = client.get("/budgets", headers=headers)
        assert list_budgets.status_code == 200
        assert len(list_budgets.json()) >= 1

        # Delete budget
        del_budget = client.delete(f"/budgets/{budget_id}", headers=headers)
        assert del_budget.status_code == 204

        # Delete transaction
        del_tx = client.delete(f"/transactions/{tx_id}", headers=headers)
        assert del_tx.status_code == 204

    finally:
        _cleanup()
        session.close()


def test_user_isolation(monkeypatch):
    """Ensure users can't access each other's data."""
    client, session = _make_client(monkeypatch)
    try:
        headers1, user1 = _setup_user(client, session, email="iso1@example.com")
        headers2, user2 = _setup_user(client, session, email="iso2@example.com")

        # Create transaction for user1
        cat_resp = client.get("/transactions/categories", headers=headers1)
        categories = cat_resp.json()
        food_cat = next(c for c in categories if c["name"] == "Food & Dining")

        tx = client.post(
            "/transactions",
            headers=headers1,
            json={
                "category": food_cat["name"],
                "amount": -50.00,
                "date": "2026-06-10",
            },
        )
        assert tx.status_code == 201
        tx_id = tx.json()["id"]

        # User2 should not see it in their list
        user2_list = client.get("/transactions", headers=headers2)
        assert all(item["id"] != tx_id for item in user2_list.json()["items"])

        # User2 cannot update or delete user1's transaction
        user2_update = client.patch(
            f"/transactions/{tx_id}",
            headers=headers2,
            json={"amount": -60},
        )
        assert user2_update.status_code == 404

        user2_delete = client.delete(f"/transactions/{tx_id}", headers=headers2)
        assert user2_delete.status_code == 404

    finally:
        _cleanup()
        session.close()


def test_refresh_token_workflow(monkeypatch):
    """Login -> Refresh token -> Use refreshed token -> Logout."""
    client, session = _make_client(monkeypatch)
    try:
        headers, _ = _setup_user(client, session)

        # Initial authenticated request
        me1 = client.get("/auth/me", headers=headers)
        assert me1.status_code == 200

        # Get a fresh refresh token
        refresh_token = _get_refresh_token(client, session, headers)

        # Refresh tokens
        refresh_resp = client.post(
            "/auth/refresh",
            json={"refresh_token": refresh_token},
        )
        assert refresh_resp.status_code == 200
        new_token = refresh_resp.json()["access_token"]
        new_headers = {"Authorization": f"Bearer {new_token}"}

        # Use refreshed token
        me2 = client.get("/auth/me", headers=new_headers)
        assert me2.status_code == 200
        assert me2.json()["email"] == "integration@example.com"

        # Logout - get another fresh token for logout
        logout_token = _get_refresh_token(client, session, headers)
        logout = client.post(
            "/auth/logout",
            json={"refresh_token": logout_token},
        )
        assert logout.status_code == 204

    finally:
        _cleanup()
        session.close()


def _get_refresh_token(client, session, headers):
    """Helper to get a fresh refresh token for the current user."""
    resp = client.post("/auth/login", json={"email": "integration@example.com", "password": "password123"})
    assert resp.status_code == 200
    return resp.json()["refresh_token"]


def test_multiple_transactions_and_budgets(monkeypatch):
    """Complex scenario with multiple transactions and budgets."""
    client, session = _make_client(monkeypatch)
    try:
        headers, _ = _setup_user(client, session)

        # Create multiple transactions
        transactions = [
            {"vendor": "Store A", "amount": -50.00, "date": "2026-06-01"},
            {"vendor": "Store B", "amount": -30.00, "date": "2026-06-05"},
            {"vendor": "Store C", "amount": 100.00, "date": "2026-06-10"},
            {"vendor": "Store D", "amount": -20.00, "date": "2026-06-12"},
        ]

        tx_ids = []
        for tx_data in transactions:
            cat_resp = client.get("/transactions/categories", headers=headers)
            categories = cat_resp.json()
            food_cat = next(c for c in categories if c["name"] == "Food & Dining")

            resp = client.post(
                "/transactions",
                headers=headers,
                json={"category": food_cat["name"], **tx_data},
            )
            assert resp.status_code == 201
            tx_ids.append(resp.json()["id"])

        # Verify pagination
        page1 = client.get("/transactions?page=1&page_size=2", headers=headers)
        assert len(page1.json()["items"]) == 2
        page2 = client.get("/transactions?page=2&page_size=2", headers=headers)
        assert len(page2.json()["items"]) == 2

        # Create budgets for two months
        cat_resp = client.get("/budgets/categories", headers=headers).json()
        food_id = next(item["id"] for item in cat_resp if item["name"] == "Food & Dining")
        shopping_id = next(item["id"] for item in cat_resp if item["name"] == "Shopping")

        client.post(
            "/budgets",
            headers=headers,
            json={"category_id": food_id, "amount": 150, "month": 6, "year": 2026},
        )
        client.post(
            "/budgets",
            headers=headers,
            json={"category_id": shopping_id, "amount": 300, "month": 6, "year": 2026},
        )

        overview = client.get("/budgets/overview?month=6&year=2026", headers=headers)
        assert overview.status_code == 200
        assert len(overview.json()["budgets"]) == 2

        # Budget history
        history = client.get("/budgets/history", headers=headers)
        assert history.status_code == 200
        assert len(history.json()["months"]) >= 1

    finally:
        _cleanup()
        session.close()