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
from app.models.account import Account
from app.models.budget import Budget
from app.models.category import Category
from app.models.chat_history import ChatMessage
from app.models.financial_profile import FinancialProfile
from app.models.goal import Goal
from app.models.transaction import Transaction
from app.schemas.user import UserCreate
from app.services import chat_service
from app.services.chat_gemini_service import GeminiChatRateLimitError


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
            full_name="Chat User",
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


def add_financial_data(session, user_id):
    account = Account(
        user_id=user_id,
        name="Cash",
        type="cash",
        balance=Decimal("0"),
        currency="USD",
    )
    session.add(account)
    session.flush()
    food = Category(user_id=user_id, name="Food & Dining", color="#f97316")
    travel = Category(user_id=user_id, name="Travel", color="#0ea5e9")
    session.add_all([food, travel])
    session.flush()
    session.add_all(
        [
            Transaction(
                account_id=account.id,
                category_id=food.id,
                amount=Decimal("-120.00"),
                vendor="Cafe",
                occurred_at=datetime(2026, 6, 5, tzinfo=timezone.utc),
                type="expense",
            ),
            Transaction(
                account_id=account.id,
                category_id=travel.id,
                amount=Decimal("-80.00"),
                vendor="Train",
                occurred_at=datetime(2026, 6, 6, tzinfo=timezone.utc),
                type="expense",
            ),
            Transaction(
                account_id=account.id,
                amount=Decimal("1000.00"),
                vendor="Payroll",
                occurred_at=datetime(2026, 6, 1, tzinfo=timezone.utc),
                type="income",
            ),
            Transaction(
                account_id=account.id,
                category_id=food.id,
                amount=Decimal("-50.00"),
                vendor="May Cafe",
                occurred_at=datetime(2026, 5, 5, tzinfo=timezone.utc),
                type="expense",
            ),
        ]
    )
    session.add(
        Budget(
            user_id=user_id,
            category_id=food.id,
            amount=Decimal("300.00"),
            month=6,
            year=2026,
        )
    )
    session.add(
        Goal(
            user_id=user_id,
            name="Emergency Fund",
            target_amount=Decimal("1000.00"),
            current_amount=Decimal("250.00"),
            is_active=True,
        )
    )
    session.commit()


def test_chat_send_persists_grounded_messages_and_context(monkeypatch):
    client, session = make_client()
    captured = {}

    def fake_answer(question, context):
        captured["question"] = question
        captured["context"] = context
        return "You spent $200.00 from June 1 through June 24."

    monkeypatch.setattr(
        chat_service.gemini_chat_client,
        "generate_answer",
        fake_answer,
    )
    try:
        user, headers = create_account(session, client, "chat@example.com")
        other_user, _ = create_account(session, client, "hidden@example.com")
        add_financial_data(session, user.id)
        add_financial_data(session, other_user.id)

        created = client.post("/chat/conversations", headers=headers, json={})
        assert created.status_code == 201
        conversation_id = created.json()["id"]

        sent = client.post(
            f"/chat/conversations/{conversation_id}/messages",
            headers=headers,
            json={"question": "How much did I spend this month?"},
        )
        assert sent.status_code == 200
        body = sent.json()
        assert body["user_message"]["role"] == "user"
        assert body["assistant_message"]["role"] == "assistant"
        assert (
            body["assistant_message"]["sources"][0]["type"]
            == "transactions"
        )
        assert body["assistant_message"]["metrics"]["total_expenses"] == 200.0
        assert body["assistant_message"]["metrics"]["total_income"] == 1000.0
        assert captured["context"]["transactions"]["expenses"] == 200.0
        assert captured["context"]["transactions"]["income"] == 1000.0
        assert captured["context"]["budgets"][0]["category"] == "Food & Dining"
        assert captured["context"]["goals"][0]["name"] == "Emergency Fund"

        messages = client.get(
            f"/chat/conversations/{conversation_id}/messages",
            headers=headers,
        )
        assert messages.status_code == 200
        assert [item["role"] for item in messages.json()["items"]] == [
            "user",
            "assistant",
        ]

        conversations = client.get("/chat/conversations", headers=headers)
        assert conversations.status_code == 200
        assert conversations.json()["items"][0]["title"].startswith("How much")
    finally:
        app.dependency_overrides.clear()
        session.close()


def test_chat_conversation_ownership_and_archive(monkeypatch):
    client, session = make_client()
    monkeypatch.setattr(
        chat_service.gemini_chat_client,
        "generate_answer",
        lambda question, context: "Answer",
    )
    try:
        first, first_headers = create_account(
            session,
            client,
            "first-chat@example.com",
        )
        _, second_headers = create_account(
            session,
            client,
            "second-chat@example.com",
        )
        add_financial_data(session, first.id)
        created = client.post(
            "/chat/conversations",
            headers=first_headers,
            json={},
        )
        conversation_id = created.json()["id"]

        hidden = client.get(
            f"/chat/conversations/{conversation_id}",
            headers=second_headers,
        )
        assert hidden.status_code == 404

        rename = client.patch(
            f"/chat/conversations/{conversation_id}",
            headers=second_headers,
            json={"title": "Stolen"},
        )
        assert rename.status_code == 404

        deleted = client.delete(
            f"/chat/conversations/{conversation_id}",
            headers=first_headers,
        )
        assert deleted.status_code == 204
        archived = client.get(
            f"/chat/conversations/{conversation_id}",
            headers=first_headers,
        )
        assert archived.status_code == 404
    finally:
        app.dependency_overrides.clear()
        session.close()


def test_chat_message_pagination_has_no_duplicates(monkeypatch):
    client, session = make_client()
    monkeypatch.setattr(
        chat_service.gemini_chat_client,
        "generate_answer",
        lambda question, context: "Answer",
    )
    try:
        user, headers = create_account(
            session,
            client,
            "pages-chat@example.com",
        )
        add_financial_data(session, user.id)
        conversation_id = client.post(
            "/chat/conversations",
            headers=headers,
            json={},
        ).json()["id"]
        for index in range(12):
            session.add(
                ChatMessage(
                    conversation_id=conversation_id,
                    role="user" if index % 2 == 0 else "assistant",
                    content=f"Message {index}",
                )
            )
        session.commit()

        first_page = client.get(
            f"/chat/conversations/{conversation_id}/messages?limit=5",
            headers=headers,
        )
        assert first_page.status_code == 200
        first_items = first_page.json()["items"]
        assert len(first_items) == 5

        second_page = client.get(
            f"/chat/conversations/{conversation_id}/messages"
            "?limit=5&before_message_id="
            f"{first_page.json()['next_before_message_id']}",
            headers=headers,
        )
        assert second_page.status_code == 200
        second_items = second_page.json()["items"]
        first_ids = {item["id"] for item in first_items}
        second_ids = {item["id"] for item in second_items}
        assert first_ids.isdisjoint(second_ids)
    finally:
        app.dependency_overrides.clear()
        session.close()


def test_chat_validation_and_provider_failure_fallback(monkeypatch):
    client, session = make_client()
    calls = {"count": 0}

    def flaky_answer(question, context):
        calls["count"] += 1
        if calls["count"] == 1:
            raise GeminiChatRateLimitError("limited")
        return "Recovered answer."

    monkeypatch.setattr(
        chat_service.gemini_chat_client,
        "generate_answer",
        flaky_answer,
    )
    try:
        user, headers = create_account(session, client, "retry@example.com")
        add_financial_data(session, user.id)
        conversation_id = client.post(
            "/chat/conversations",
            headers=headers,
            json={},
        ).json()["id"]

        empty = client.post(
            f"/chat/conversations/{conversation_id}/messages",
            headers=headers,
            json={"question": "   "},
        )
        assert empty.status_code == 422

        fallback = client.post(
            f"/chat/conversations/{conversation_id}/messages",
            headers=headers,
            json={"question": "Am I staying within my budgets?"},
        )
        assert fallback.status_code == 200
        body = fallback.json()
        assert body["user_message"]["status"] == "complete"
        assert body["assistant_message"]["role"] == "assistant"
        assert (
            "MoneyMate calculated"
            in body["assistant_message"]["content"]
        )
        messages = client.get(
            f"/chat/conversations/{conversation_id}/messages",
            headers=headers,
        ).json()["items"]
        assert [item["role"] for item in messages].count("user") == 1
        assert [item["role"] for item in messages].count("assistant") == 1
    finally:
        app.dependency_overrides.clear()
        session.close()
