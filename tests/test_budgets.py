from datetime import datetime, timezone
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.auth.services import create_user
from app.db import Base
from app.dependencies import get_db
from app.main import app
from app.models.financial_profile import FinancialProfile
from app.repositories.transaction_repository import transaction_repository
from app.schemas.transaction import TransactionCreate
from app.schemas.user import UserCreate
from app.services.budget_service import get_progress_state


def make_client(monkeypatch):
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    monkeypatch.setattr(transaction_repository, "_transactions", [])

    def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app), session


def create_account(session, client, email, categories):
    user = create_user(
        session,
        UserCreate(
            full_name="Budget User",
            email=email,
            password="password-123",
        ),
    )
    profile = (
        session.query(FinancialProfile)
        .filter(FinancialProfile.user_id == user.id)
        .first()
    )
    profile.spending_categories = categories
    profile.currency = "USD"
    session.commit()
    login = client.post(
        "/auth/login",
        json={"email": email, "password": "password-123"},
    )
    assert login.status_code == 200
    return user, {"Authorization": f"Bearer {login.json()['access_token']}"}


def add_transaction(user_id, date, amount, category):
    return transaction_repository.create(
        str(user_id),
        TransactionCreate(
            date=date,
            amount=Decimal(amount),
            category=category,
            vendor="Test",
            notes="",
        ),
    )


def test_budget_crud_duplicate_prevention_and_calculations(monkeypatch):
    client, session = make_client(monkeypatch)
    try:
        user, headers = create_account(
            session,
            client,
            "budget@example.com",
            ["Food & Dining", "Shopping"],
        )
        categories = client.get("/budgets/categories", headers=headers)
        assert categories.status_code == 200
        food = next(
            item
            for item in categories.json()
            if item["name"] == "Food & Dining"
        )

        created = client.post(
            "/budgets",
            headers=headers,
            json={
                "category_id": food["id"],
                "amount": 100,
                "month": 6,
                "year": 2026,
            },
        )
        assert created.status_code == 201
        budget_id = created.json()["id"]

        duplicate = client.post(
            "/budgets",
            headers=headers,
            json={
                "category_id": food["id"],
                "amount": 120,
                "month": 6,
                "year": 2026,
            },
        )
        assert duplicate.status_code == 409
        assert duplicate.json()["detail"] == (
            "A budget already exists for this category and month."
        )

        add_transaction(
            user.id,
            datetime(2026, 6, 5, tzinfo=timezone.utc),
            "-85.00",
            "Food & Dining",
        )
        add_transaction(
            user.id,
            datetime(2026, 6, 6, tzinfo=timezone.utc),
            "250.00",
            "Food & Dining",
        )

        overview = client.get(
            "/budgets/overview?month=6&year=2026",
            headers=headers,
        )
        assert overview.status_code == 200
        summary = overview.json()["budgets"][0]
        assert Decimal(str(summary["actual_spending"])) == Decimal("85.00")
        assert Decimal(str(summary["usage_percentage"])) == Decimal("85.00")
        assert summary["alert_level"] == "warning"
        assert summary["progress_state"] == "orange"
        assert summary["status"] == "close_to_budget"

        updated = client.patch(
            f"/budgets/{budget_id}",
            headers=headers,
            json={"amount": 80},
        )
        assert updated.status_code == 200

        comparison = client.get(
            "/budgets/comparison?month=6&year=2026",
            headers=headers,
        )
        assert comparison.status_code == 200
        row = comparison.json()[0]
        assert row["alert_level"] == "alert"
        assert Decimal(str(row["variance_amount"])) == Decimal("-5.00")
        assert Decimal(str(row["variance_percentage"])) == Decimal("-6.25")

        deleted = client.delete(f"/budgets/{budget_id}", headers=headers)
        assert deleted.status_code == 204
        missing = client.get(f"/budgets/{budget_id}", headers=headers)
        assert missing.status_code == 404
    finally:
        app.dependency_overrides.clear()
        session.close()


def test_new_user_budget_has_zero_spent_until_user_adds_expense(monkeypatch):
    client, session = make_client(monkeypatch)
    try:
        user, headers = create_account(
            session,
            client,
            "zero-spend@example.com",
            ["Food & Dining"],
        )
        food = client.get("/budgets/categories", headers=headers).json()[0]
        created = client.post(
            "/budgets",
            headers=headers,
            json={
                "category_id": food["id"],
                "amount": 100,
                "month": 6,
                "year": 2026,
            },
        )
        assert created.status_code == 201

        empty_overview = client.get(
            "/budgets/overview?month=6&year=2026",
            headers=headers,
        )
        assert empty_overview.status_code == 200
        empty_summary = empty_overview.json()["budgets"][0]
        assert Decimal(str(empty_summary["actual_spending"])) == Decimal(
            "0.00"
        )
        assert Decimal(str(empty_summary["remaining_amount"])) == Decimal(
            "100.00"
        )

        add_transaction(
            user.id,
            datetime(2026, 6, 12, tzinfo=timezone.utc),
            "-12.34",
            "Food & Dining",
        )
        updated_overview = client.get(
            "/budgets/overview?month=6&year=2026",
            headers=headers,
        )
        updated_summary = updated_overview.json()["budgets"][0]
        assert Decimal(str(updated_summary["actual_spending"])) == Decimal(
            "12.34"
        )
        assert Decimal(str(updated_summary["remaining_amount"])) == Decimal(
            "87.66"
        )
    finally:
        app.dependency_overrides.clear()
        session.close()


def test_budget_user_isolation_and_category_ownership(monkeypatch):
    client, session = make_client(monkeypatch)
    try:
        _, first_headers = create_account(
            session,
            client,
            "first@example.com",
            ["Food & Dining"],
        )
        _, second_headers = create_account(
            session,
            client,
            "second@example.com",
            ["Shopping"],
        )
        first_category = client.get(
            "/budgets/categories",
            headers=first_headers,
        ).json()[0]
        second_category = client.get(
            "/budgets/categories",
            headers=second_headers,
        ).json()[0]

        created = client.post(
            "/budgets",
            headers=first_headers,
            json={
                "category_id": first_category["id"],
                "amount": 100,
                "month": 6,
                "year": 2026,
            },
        )
        assert created.status_code == 201

        hidden = client.get(
            f"/budgets/{created.json()['id']}",
            headers=second_headers,
        )
        assert hidden.status_code == 404

        invalid_category = client.post(
            "/budgets",
            headers=first_headers,
            json={
                "category_id": second_category["id"],
                "amount": 100,
                "month": 7,
                "year": 2026,
            },
        )
        assert invalid_category.status_code == 400
    finally:
        app.dependency_overrides.clear()
        session.close()


def test_budget_history_and_threshold_boundaries(monkeypatch):
    client, session = make_client(monkeypatch)
    try:
        user, headers = create_account(
            session,
            client,
            "history@example.com",
            ["Food & Dining", "Shopping"],
        )
        categories = client.get("/budgets/categories", headers=headers).json()
        food = next(
            item
            for item in categories
            if item["name"] == "Food & Dining"
        )
        shopping = next(
            item
            for item in categories
            if item["name"] == "Shopping"
        )

        for month, category, amount in [
            (5, food, 100),
            (6, food, 100),
            (6, shopping, 100),
        ]:
            response = client.post(
                "/budgets",
                headers=headers,
                json={
                    "category_id": category["id"],
                    "amount": amount,
                    "month": month,
                    "year": 2026,
                },
            )
            assert response.status_code == 201

        add_transaction(
            user.id,
            datetime(2026, 5, 10, tzinfo=timezone.utc),
            "-90.00",
            "Food & Dining",
        )
        add_transaction(
            user.id,
            datetime(2026, 6, 10, tzinfo=timezone.utc),
            "-125.00",
            "Food & Dining",
        )
        add_transaction(
            user.id,
            datetime(2026, 6, 11, tzinfo=timezone.utc),
            "-20.00",
            "Shopping",
        )

        history = client.get("/budgets/history", headers=headers)
        assert history.status_code == 200
        june = next(
            item
            for item in history.json()["months"]
            if item["month"] == 6
        )
        assert Decimal(str(june["adherence_percentage"])) == Decimal("50.00")
        assert june["categories_within_budget"] == 1
        assert june["categories_over_budget"] == 1
        assert june["trend"] == "decline"
        assert Decimal(str(june["trend_percentage_points"])) == Decimal(
            "-50.00"
        )

        assert get_progress_state(Decimal("49.99")) == "green"
        assert get_progress_state(Decimal("50")) == "yellow"
        assert get_progress_state(Decimal("80")) == "orange"
        assert get_progress_state(Decimal("100")) == "red"
    finally:
        app.dependency_overrides.clear()
        session.close()


def test_budget_create_can_resolve_category_name_fallback(monkeypatch):
    client, session = make_client(monkeypatch)
    try:
        _, headers = create_account(
            session,
            client,
            "fallback@example.com",
            [],
        )

        created = client.post(
            "/budgets",
            headers=headers,
            json={
                "category_name": "Food & Dining",
                "amount": 150,
                "month": 6,
                "year": 2026,
            },
        )
        assert created.status_code == 201
        assert created.json()["category_name"] == "Food & Dining"
    finally:
        app.dependency_overrides.clear()
        session.close()
