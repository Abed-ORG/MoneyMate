from datetime import date, datetime, timezone
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
from app.models.account import Account
from app.models.category import Category
from app.models.financial_profile import FinancialProfile
from app.models.transaction import Transaction
from app.schemas.user import UserCreate
from app.services.analytics_service import (
    TransactionAnalyticsRow,
    calculate_percentage_change,
    moving_average,
    previous_equivalent_period,
    trend_points,
)


def make_client():
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
    return TestClient(app), session


def create_account(session, client, email):
    user = create_user(
        session,
        UserCreate(
            full_name="Analytics User",
            email=email,
            password="password-123",
        ),
    )
    profile = (
        session.query(FinancialProfile)
        .filter(FinancialProfile.user_id == user.id)
        .first()
    )
    profile.currency = "USD"
    session.commit()
    login = client.post(
        "/auth/login",
        json={"email": email, "password": "password-123"},
    )
    assert login.status_code == 200
    return user, {"Authorization": f"Bearer {login.json()['access_token']}"}


def add_account(session, user_id, name="Cash"):
    account = Account(
        user_id=user_id,
        name=name,
        type="cash",
        balance=Decimal("0"),
        currency="USD",
    )
    session.add(account)
    session.flush()
    return account


def add_category(session, user_id, name, color):
    category = Category(user_id=user_id, name=name, color=color)
    session.add(category)
    session.flush()
    return category


def add_transaction(session, account, amount, occurred_at, category=None):
    transaction = Transaction(
        account_id=account.id,
        category_id=category.id if category else None,
        amount=Decimal(amount),
        vendor="Test",
        occurred_at=occurred_at,
        type="income" if Decimal(amount) > 0 else "expense",
    )
    session.add(transaction)
    session.flush()
    return transaction


def test_previous_period_and_percentage_change_helpers():
    previous = previous_equivalent_period(
        date(2026, 1, 1),
        date(2026, 1, 31),
    )
    assert previous == (date(2025, 12, 1), date(2025, 12, 31))

    single_day = previous_equivalent_period(
        date(2026, 6, 15),
        date(2026, 6, 15),
    )
    assert single_day == (date(2026, 6, 14), date(2026, 6, 14))

    assert calculate_percentage_change(
        Decimal("25"),
        Decimal("0"),
    ).label == "New"
    assert calculate_percentage_change(
        Decimal("0"),
        Decimal("0"),
    ).label == "No previous data"
    decline = calculate_percentage_change(Decimal("75"), Decimal("100"))
    assert decline.value == Decimal("-25.00")
    assert decline.direction == "decrease"


def test_moving_average_and_daily_weekly_gap_filling():
    values = [
        Decimal("10"),
        Decimal("0"),
        Decimal("20"),
        Decimal("30"),
    ]
    assert moving_average(values, 2) == [
        Decimal("10.00"),
        Decimal("5.00"),
        Decimal("10.00"),
        Decimal("25.00"),
    ]

    rows = [
        TransactionAnalyticsRow(
            amount=Decimal("-14"),
            occurred_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
            category_id=1,
            category_name="Food",
            category_color="#111111",
        ),
        TransactionAnalyticsRow(
            amount=Decimal("-7"),
            occurred_at=datetime(2026, 1, 8, tzinfo=timezone.utc),
            category_id=1,
            category_name="Food",
            category_color="#111111",
        ),
    ]
    daily = trend_points(rows, date(2026, 1, 1), date(2026, 1, 3), "daily")
    assert [item.spending for item in daily] == [
        Decimal("14.00"),
        Decimal("0.00"),
        Decimal("0.00"),
    ]
    assert daily[0].moving_average == Decimal("14.00")

    weekly = trend_points(rows, date(2026, 1, 1), date(2026, 1, 14), "weekly")
    assert [item.spending for item in weekly] == [
        Decimal("14.00"),
        Decimal("7.00"),
        Decimal("0.00"),
    ]
    assert weekly[1].moving_average == Decimal("10.50")


def test_dashboard_analytics_endpoint_filters_and_aggregates(monkeypatch):
    client, session = make_client()
    try:
        user, headers = create_account(
            session,
            client,
            "analytics@example.com",
        )
        other_user, _ = create_account(
            session,
            client,
            "other-analytics@example.com",
        )
        cash = add_account(session, user.id, "Cash")
        card = add_account(session, user.id, "Card")
        other_account = add_account(session, other_user.id, "Hidden")
        food = add_category(session, user.id, "Food", "#22c55e")
        travel = add_category(session, user.id, "Travel", "#38bdf8")
        other_food = add_category(session, other_user.id, "Food", "#000000")

        add_transaction(
            session,
            cash,
            "1000.00",
            datetime(2026, 1, 2, tzinfo=timezone.utc),
            None,
        )
        add_transaction(
            session,
            cash,
            "-120.00",
            datetime(2026, 1, 3, tzinfo=timezone.utc),
            food,
        )
        add_transaction(
            session,
            cash,
            "-80.00",
            datetime(2026, 1, 5, tzinfo=timezone.utc),
            food,
        )
        add_transaction(
            session,
            card,
            "-50.00",
            datetime(2026, 1, 10, tzinfo=timezone.utc),
            travel,
        )
        add_transaction(
            session,
            cash,
            "-40.00",
            datetime(2025, 12, 20, tzinfo=timezone.utc),
            food,
        )
        add_transaction(
            session,
            other_account,
            "-999.00",
            datetime(2026, 1, 3, tzinfo=timezone.utc),
            other_food,
        )
        session.commit()

        response = client.get(
            "/analytics/dashboard?start_date=2026-01-01&"
            "end_date=2026-01-31&months=2",
            headers=headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert Decimal(str(data["summary"]["current"]["total_income"])) == (
            Decimal("1000.00")
        )
        assert Decimal(str(data["summary"]["current"]["total_expenses"])) == (
            Decimal("250.00")
        )
        assert Decimal(str(data["summary"]["current"]["net_amount"])) == (
            Decimal("750.00")
        )
        assert Decimal(str(data["summary"]["previous"]["total_expenses"])) == (
            Decimal("40.00")
        )
        assert data["currency"] == "USD"

        spending = data["spending_by_category"]
        assert spending[0]["category_name"] == "Food"
        assert Decimal(str(spending[0]["amount"])) == Decimal("200.00")
        assert Decimal(str(spending[0]["percentage"])) == Decimal("80.00")
        assert spending[0]["color"] == "#22c55e"

        months = data["monthly_income_expenses"]
        assert [item["month"] for item in months] == ["2025-12", "2026-01"]
        assert Decimal(str(months[1]["expenses"])) == Decimal("250.00")

        trend = data["spending_trend"]
        assert len(trend) == 31
        assert trend[0]["key"] == "2026-01-01"
        assert Decimal(str(trend[2]["spending"])) == Decimal("120.00")

        filtered = client.get(
            "/analytics/dashboard?start_date=2026-01-01&"
            f"end_date=2026-01-31&category_ids={food.id}",
            headers=headers,
        )
        assert filtered.status_code == 200
        filtered_data = filtered.json()
        filtered_income = filtered_data["summary"]["current"]["total_income"]
        assert Decimal(str(filtered_income)) == (
            Decimal("1000.00")
        )
        filtered_expenses = (
            filtered_data["summary"]["current"]["total_expenses"]
        )
        assert Decimal(str(filtered_expenses)) == (
            Decimal("200.00")
        )
        assert len(filtered_data["spending_by_category"]) == 1
        assert (
            filtered_data["spending_by_category"][0]["category_name"]
            == "Food"
        )

        account_filtered = client.get(
            "/analytics/dashboard?start_date=2026-01-01&"
            f"end_date=2026-01-31&account_ids={card.id}",
            headers=headers,
        )
        assert account_filtered.status_code == 200
        account_data = account_filtered.json()
        account_income = account_data["summary"]["current"]["total_income"]
        assert Decimal(str(account_income)) == (
            Decimal("0.00")
        )
        account_expenses = (
            account_data["summary"]["current"]["total_expenses"]
        )
        assert Decimal(str(account_expenses)) == (
            Decimal("50.00")
        )
    finally:
        app.dependency_overrides.clear()
        session.close()


def test_dashboard_analytics_validation(monkeypatch):
    client, session = make_client()
    try:
        _, headers = create_account(
            session,
            client,
            "analytics-validation@example.com",
        )
        bad_range = client.get(
            "/analytics/dashboard?start_date=2026-02-01&end_date=2026-01-01",
            headers=headers,
        )
        assert bad_range.status_code == 400
        assert bad_range.json()["detail"] == (
            "Start date must be before or equal to end date."
        )

        bad_category = client.get(
            "/analytics/dashboard?category_ids=not-a-number",
            headers=headers,
        )
        assert bad_category.status_code == 400
        assert "category_ids" in bad_category.json()["detail"]
    finally:
        app.dependency_overrides.clear()
        session.close()
