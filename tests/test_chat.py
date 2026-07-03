from datetime import date, datetime, timezone
from decimal import Decimal
import json
from urllib.error import HTTPError

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
from app.services.chat_context_service import requested_period
from app.services.chat_gemini_service import (
    DEFAULT_CHAT_TIMEOUT_SECONDS,
    GeminiChatClient,
    GeminiChatRateLimitError,
    MODEL_COOLDOWNS,
    SIMPLE_MAX_OUTPUT_TOKENS,
    SMART_MAX_OUTPUT_TOKENS,
    retry_after_from_text,
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

    def fake_answer(question, context, tier="smart"):
        captured["question"] = question
        captured["context"] = context
        captured["tier"] = tier
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
            json={"question": "How much did I spend in June 2026?"},
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
        assert captured["context"]["transactions"]["transactions"] == [
            {
                "date": "2026-06-06",
                "vendor": "Train",
                "category": "Travel",
                "amount": -80.0,
                "transaction_type": "expense",
                "notes": "",
            },
            {
                "date": "2026-06-05",
                "vendor": "Cafe",
                "category": "Food & Dining",
                "amount": -120.0,
                "transaction_type": "expense",
                "notes": "",
            },
            {
                "date": "2026-06-01",
                "vendor": "Payroll",
                "category": "Other",
                "amount": 1000.0,
                "transaction_type": "income",
                "notes": "",
            },
        ]
        assert (
            captured["context"]["transactions"]["transactions_truncated"]
            is False
        )
        assert "budgets" not in captured["context"]
        assert "goals" not in captured["context"]
        assert captured["tier"] == "smart"

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
        lambda question, context, tier="smart": "Answer",
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
        lambda question, context, tier="smart": "Answer",
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


def test_chat_validation_and_provider_failure_is_retryable(monkeypatch):
    client, session = make_client()

    def unavailable_answer(question, context, tier="smart"):
        raise GeminiChatRateLimitError("limited")

    monkeypatch.setattr(
        chat_service.gemini_chat_client,
        "generate_answer",
        unavailable_answer,
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

        failure = client.post(
            f"/chat/conversations/{conversation_id}/messages",
            headers=headers,
            json={"question": "Am I staying within my budgets?"},
        )
        assert failure.status_code == 503
        detail = failure.json()["detail"]
        assert detail["retryable"] is True
        assert detail["user_message"]["status"] == "assistant_failed"
        assert detail["user_message"]["error_code"] == "gemini_rate_limited"
        messages = client.get(
            f"/chat/conversations/{conversation_id}/messages",
            headers=headers,
        ).json()["items"]
        assert [item["role"] for item in messages].count("user") == 1
        assert [item["role"] for item in messages].count("assistant") == 0
    finally:
        app.dependency_overrides.clear()
        session.close()


def test_chat_greeting_gets_friendly_reply_without_finance_refusal(
    monkeypatch,
):
    client, session = make_client()
    captured = {}

    def friendly_answer(question, context, tier="smart"):
        captured["question"] = question
        captured["context"] = context
        captured["tier"] = tier
        return "Hi! Happy to help."

    monkeypatch.setattr(
        chat_service.gemini_chat_client,
        "generate_answer",
        friendly_answer,
    )
    try:
        _, headers = create_account(session, client, "hello@example.com")
        conversation_id = client.post(
            "/chat/conversations",
            headers=headers,
            json={},
        ).json()["id"]
        session.add_all(
            [
                ChatMessage(
                    conversation_id=conversation_id,
                    role="user",
                    content="hello " + ("there " * 80),
                ),
                ChatMessage(
                    conversation_id=conversation_id,
                    role="assistant",
                    content="Hi! " + ("How can I help? " * 80),
                ),
                ChatMessage(
                    conversation_id=conversation_id,
                    role="user",
                    content="thanks " + ("a lot " * 80),
                ),
                ChatMessage(
                    conversation_id=conversation_id,
                    role="assistant",
                    content="You're welcome. " + ("Anytime. " * 80),
                ),
            ]
        )
        session.commit()

        response = client.post(
            f"/chat/conversations/{conversation_id}/messages",
            headers=headers,
            json={"question": "hiiii"},
        )

        assert response.status_code == 200
        content = response.json()["assistant_message"]["content"]
        assert "Hi!" in content
        assert "finance questions" not in content
        assert "Sorry" not in content
        assert captured["tier"] == "simple"
        assert captured["context"]["mode"] == "general_conversation"
        assert len(captured["context"]["conversation_history"]) == 4
        assert all(
            len(message["content"]) <= 260
            for message in captured["context"]["conversation_history"]
        )
        assert response.json()["assistant_message"]["sources"] == []
        assert response.json()["assistant_message"]["metrics"] == {}
    finally:
        app.dependency_overrides.clear()
        session.close()


def test_chat_non_finance_budge_phrase_stays_simple(monkeypatch):
    client, session = make_client()
    captured = {}

    def simple_answer(question, context, tier="smart"):
        captured["context"] = context
        captured["tier"] = tier
        return "I hear you. I can help with MoneyMate finances when needed."

    monkeypatch.setattr(
        chat_service.gemini_chat_client,
        "generate_answer",
        simple_answer,
    )
    try:
        _, headers = create_account(session, client, "budge@example.com")
        conversation_id = client.post(
            "/chat/conversations",
            headers=headers,
            json={},
        ).json()["id"]

        response = client.post(
            f"/chat/conversations/{conversation_id}/messages",
            headers=headers,
            json={"question": "I won't budge on this"},
        )

        assert response.status_code == 200
        assert captured["tier"] == "simple"
        assert captured["context"]["mode"] == "general_conversation"
    finally:
        app.dependency_overrides.clear()
        session.close()


def test_chat_simple_tier_receives_recent_history_for_context(monkeypatch):
    client, session = make_client()
    captured = {}

    def continuation_answer(question, context, tier="smart"):
        captured["context"] = context
        captured["tier"] = tier
        return "Of course, take your time."

    monkeypatch.setattr(
        chat_service.gemini_chat_client,
        "generate_answer",
        continuation_answer,
    )
    try:
        _, headers = create_account(session, client, "thinking@example.com")
        conversation_id = client.post(
            "/chat/conversations",
            headers=headers,
            json={},
        ).json()["id"]
        session.add_all(
            [
                ChatMessage(
                    conversation_id=conversation_id,
                    role="assistant",
                    content=(
                        "Adding 200.00 USD to your phone goal would move "
                        "your progress from 22% to 42%. How would you like "
                        "to proceed?"
                    ),
                ),
                ChatMessage(
                    conversation_id=conversation_id,
                    role="user",
                    content="hmmm let me think",
                ),
                ChatMessage(
                    conversation_id=conversation_id,
                    role="assistant",
                    content="Of course, take your time.",
                ),
            ]
        )
        session.commit()

        response = client.post(
            f"/chat/conversations/{conversation_id}/messages",
            headers=headers,
            json={
                "question": (
                    "no i meant let me think on how to proceed"
                )
            },
        )

        assert response.status_code == 200
        assert captured["tier"] == "simple"
        assert len(captured["context"]["conversation_history"]) == 3
        assert any(
            "How would you like to proceed?" in message["content"]
            for message in captured["context"]["conversation_history"]
        )
    finally:
        app.dependency_overrides.clear()
        session.close()


def test_chat_routes_typo_finance_question_to_smart_model(monkeypatch):
    client, session = make_client()
    captured = {}

    def finance_answer(question, context, tier="smart"):
        captured["tier"] = tier
        captured["context"] = context
        return "Food & Dining is your top category."

    monkeypatch.setattr(
        chat_service.gemini_chat_client,
        "generate_answer",
        finance_answer,
    )
    try:
        user, headers = create_account(session, client, "category@example.com")
        add_financial_data(session, user.id)
        conversation_id = client.post(
            "/chat/conversations",
            headers=headers,
            json={},
        ).json()["id"]

        response = client.post(
            f"/chat/conversations/{conversation_id}/messages",
            headers=headers,
            json={
                "question": (
                    "Which catgory did I spend the most on in June 2026?"
                )
            },
        )

        assert response.status_code == 200
        content = response.json()["assistant_message"]["content"]
        assert "Food & Dining" in content
        assert captured["tier"] == "smart"
        assert captured["context"]["transactions"]["expenses"] == 200.0
    finally:
        app.dependency_overrides.clear()
        session.close()


def test_chat_budget_question_uses_budget_context_without_goals(monkeypatch):
    client, session = make_client()
    captured = {}

    def budget_answer(question, context, tier="smart"):
        captured["context"] = context
        captured["tier"] = tier
        return "Food & Dining has a 300.00 USD budget."

    monkeypatch.setattr(
        chat_service.gemini_chat_client,
        "generate_answer",
        budget_answer,
    )
    try:
        user, headers = create_account(
            session,
            client,
            "budget-chat@example.com",
        )
        add_financial_data(session, user.id)
        conversation_id = client.post(
            "/chat/conversations",
            headers=headers,
            json={},
        ).json()["id"]

        response = client.post(
            f"/chat/conversations/{conversation_id}/messages",
            headers=headers,
            json={
                "question": (
                    "What is my Food & Dining budget for June 2026?"
                )
            },
        )

        assert response.status_code == 200
        assert captured["tier"] == "smart"
        assert captured["context"]["budgets"][0]["category"] == "Food & Dining"
        assert "transactions" not in captured["context"]
        assert "goals" not in captured["context"]
        assert response.json()["assistant_message"]["sources"][0]["type"] == (
            "budgets"
        )
        assert response.json()["assistant_message"]["metrics"] == {
            "budget_count": 1
        }
    finally:
        app.dependency_overrides.clear()
        session.close()


def test_chat_routes_short_finance_followup_to_smart_model(monkeypatch):
    client, session = make_client()
    captured = {}

    def followup_answer(question, context, tier="smart"):
        captured["question"] = question
        captured["context"] = context
        captured["tier"] = tier
        return "Your lowest spending category was Travel at 80.00 USD."

    monkeypatch.setattr(
        chat_service.gemini_chat_client,
        "generate_answer",
        followup_answer,
    )
    try:
        user, headers = create_account(session, client, "least@example.com")
        add_financial_data(session, user.id)
        conversation_id = client.post(
            "/chat/conversations",
            headers=headers,
            json={},
        ).json()["id"]
        session.add_all(
            [
                ChatMessage(
                    conversation_id=conversation_id,
                    role="user",
                    content=(
                        "what was the catgry i spent most in june"
                    ),
                ),
                ChatMessage(
                    conversation_id=conversation_id,
                    role="assistant",
                    content=(
                        "In June 2026, your highest spending category "
                        "was Food & Dining."
                    ),
                ),
            ]
        )
        session.commit()

        response = client.post(
            f"/chat/conversations/{conversation_id}/messages",
            headers=headers,
            json={"question": "what about least"},
        )

        assert response.status_code == 200
        assert "Travel" in response.json()["assistant_message"]["content"]
        assert captured["question"] == "what about least"
        assert captured["tier"] == "smart"
        assert captured["context"]["period"]["label"] == "June 2026"
        assert captured["context"]["transactions"]["category_totals"][1] == {
            "category": "Travel",
            "total": 80.0,
            "percentage_of_expenses": 40.0,
        }
    finally:
        app.dependency_overrides.clear()
        session.close()


def test_chat_affirmative_followup_continues_previous_offer(
    monkeypatch,
):
    client, session = make_client()

    def followup_answer(question, context, tier="smart"):
        assert tier == "smart"
        assert context["transactions"]["expenses"] == 200.0
        return "You spent 200.00 USD and your budgets are still on track."

    monkeypatch.setattr(
        chat_service.gemini_chat_client,
        "generate_answer",
        followup_answer,
    )
    try:
        user, headers = create_account(session, client, "yes@example.com")
        add_financial_data(session, user.id)
        conversation_id = client.post(
            "/chat/conversations",
            headers=headers,
            json={},
        ).json()["id"]
        session.add(
            ChatMessage(
                conversation_id=conversation_id,
                role="assistant",
                content=(
                    "Currently, I have data available for June 2026. "
                    "Would you like to know more about your spending, "
                    "budget, savings, or goals for this period?"
                ),
            )
        )
        session.commit()

        response = client.post(
            f"/chat/conversations/{conversation_id}/messages",
            headers=headers,
            json={"question": "yesplease"},
        )

        assert response.status_code == 200
        content = response.json()["assistant_message"]["content"]
        assert "200.00 USD" in content
        assert "Hello! How can I help" not in content
        assert response.json()["assistant_message"]["metrics"][
            "total_expenses"
        ] == 200.0
    finally:
        app.dependency_overrides.clear()
        session.close()


def test_chat_keep_going_followup_uses_current_goal_context(monkeypatch):
    client, session = make_client()
    captured = {}

    def followup_answer(question, context, tier="smart"):
        captured["question"] = question
        captured["context"] = context
        captured["tier"] = tier
        goal_names = [goal["name"] for goal in context["goals"]]
        assert goal_names == [captured["current_goal_name"]]
        return f"Your current goal is {captured['current_goal_name']}."

    monkeypatch.setattr(
        chat_service.gemini_chat_client,
        "generate_answer",
        followup_answer,
    )
    try:
        user, headers = create_account(
            session, client, "keepgoing@example.com"
        )
        add_financial_data(session, user.id)
        current_goal = (
            session.query(Goal)
            .filter(Goal.user_id == user.id)
            .one()
        )
        captured["current_goal_name"] = current_goal.name
        stale_goal_name = " ".join(reversed(current_goal.name.split()))
        conversation_id = client.post(
            "/chat/conversations",
            headers=headers,
            json={},
        ).json()["id"]
        followup_question = "yes keep going"
        session.add(
            ChatMessage(
                conversation_id=conversation_id,
                role="assistant",
                content=(
                    f"Your savings goals include {stale_goal_name}. "
                    f"I can answer if you say {followup_question}."
                ),
            )
        )
        session.commit()

        response = client.post(
            f"/chat/conversations/{conversation_id}/messages",
            headers=headers,
            json={"question": followup_question},
        )

        assert response.status_code == 200
        assert response.json()["assistant_message"]["content"] == (
            f"Your current goal is {current_goal.name}."
        )
        assert captured["tier"] == "smart"
        assert stale_goal_name not in {
            goal["name"] for goal in captured["context"]["goals"]
        }
        assert response.json()["assistant_message"]["metrics"][
            "goal_count"
        ] == 1
    finally:
        app.dependency_overrides.clear()
        session.close()


def test_gemini_chat_tries_fallback_model_after_rate_limit(
    monkeypatch,
):
    calls = []

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def read(self):
            return json.dumps(
                {
                    "candidates": [
                        {
                            "content": {
                                "parts": [
                                    {
                                        "text": (
                                            "You spent 509.50 USD in "
                                            "June 2026."
                                        )
                                    }
                                ]
                            }
                        }
                    ]
                }
            ).encode("utf-8")

    def fake_urlopen(req, timeout):
        calls.append(req.full_url)
        if len(calls) == 1:
            raise HTTPError(
                req.full_url,
                429,
                "rate limited",
                hdrs=None,
                fp=None,
            )
        return FakeResponse()

    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-2.5-flash")
    monkeypatch.setenv("GEMINI_FALLBACK_MODELS", "gemini-3.1-flash-lite")
    monkeypatch.setattr(
        "app.services.chat_gemini_service.request.urlopen",
        fake_urlopen,
    )

    client = GeminiChatClient()
    answer = client.generate_answer(
        "How much did I spend this month?",
        {"currency": "USD", "transactions": {"expenses": 509.5}},
    )

    assert answer == "You spent 509.50 USD in June 2026."
    assert "gemini-2.5-flash" in calls[0]
    assert "gemini-3.1-flash-lite" in calls[1]
    assert len(calls) == 2


def test_gemini_chat_sets_tier_specific_output_limits(monkeypatch):
    MODEL_COOLDOWNS.clear()
    bodies = []
    timeouts = []

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def read(self):
            return json.dumps(
                {
                    "candidates": [
                        {
                            "content": {
                                "parts": [{"text": "Short answer."}]
                            }
                        }
                    ]
                }
            ).encode("utf-8")

    def fake_urlopen(req, timeout):
        bodies.append(json.loads(req.data.decode("utf-8")))
        timeouts.append(timeout)
        return FakeResponse()

    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-2.5-flash")
    monkeypatch.setenv("GEMINI_SIMPLE_MODEL", "gemini-2.5-flash-lite")
    monkeypatch.setattr(
        "app.services.chat_gemini_service.request.urlopen",
        fake_urlopen,
    )

    client = GeminiChatClient()
    assert client.generate_answer("hi", {}, tier="simple") == "Short answer."
    assert (
        client.generate_answer(
            "How much did I spend?",
            {"currency": "USD"},
            tier="smart",
        )
        == "Short answer."
    )

    assert bodies[0]["generationConfig"]["maxOutputTokens"] == (
        SIMPLE_MAX_OUTPUT_TOKENS
    )
    assert bodies[1]["generationConfig"]["maxOutputTokens"] == (
        SMART_MAX_OUTPUT_TOKENS
    )
    assert timeouts == [
        DEFAULT_CHAT_TIMEOUT_SECONDS,
        DEFAULT_CHAT_TIMEOUT_SECONDS,
    ]


def test_gemini_chat_uses_configured_timeout_and_retries(monkeypatch):
    MODEL_COOLDOWNS.clear()
    calls = []

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def read(self):
            return json.dumps(
                {
                    "candidates": [
                        {
                            "content": {
                                "parts": [{"text": "Recovered answer."}]
                            }
                        }
                    ]
                }
            ).encode("utf-8")

    def fake_urlopen(req, timeout):
        calls.append((req.full_url, timeout))
        if len(calls) == 1:
            raise TimeoutError("slow provider")
        return FakeResponse()

    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-2.5-flash")
    monkeypatch.setenv("GEMINI_CHAT_TIMEOUT_SECONDS", "45")
    monkeypatch.setattr(
        "app.services.chat_gemini_service.request.urlopen",
        fake_urlopen,
    )

    client = GeminiChatClient()
    answer = client.generate_answer("Question", {})

    assert answer == "Recovered answer."
    assert len(calls) == 2
    assert calls[0][0] == calls[1][0]
    assert calls[0][1] == 45
    assert calls[1][1] == 45


def test_gemini_chat_skips_model_during_rate_limit_cooldown(monkeypatch):
    MODEL_COOLDOWNS.clear()
    calls = []

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def read(self):
            return json.dumps(
                {
                    "candidates": [
                        {
                            "content": {
                                "parts": [{"text": "Fallback answer."}]
                            }
                        }
                    ]
                }
            ).encode("utf-8")

    def fake_urlopen(req, timeout):
        calls.append(req.full_url)
        return FakeResponse()

    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-2.5-flash")
    monkeypatch.setenv("GEMINI_FALLBACK_MODELS", "gemini-3.1-flash-lite")
    monkeypatch.setattr(
        "app.services.chat_gemini_service.request.urlopen",
        fake_urlopen,
    )

    client = GeminiChatClient()
    client.cool_down_model("gemini-2.5-flash", 30)

    answer = client.generate_answer("Question", {})

    assert answer == "Fallback answer."
    assert len(calls) == 1
    assert "gemini-3.1-flash-lite" in calls[0]
    MODEL_COOLDOWNS.clear()


def test_retry_after_from_text_reads_gemini_quota_message():
    assert retry_after_from_text("Please retry in 28.996338323s.") == (
        28.996338323
    )


def test_requested_period_supports_named_month_and_year():
    assert requested_period(
        "what were my expenses for april 2026",
        today=date(2026, 6, 25),
    ) == (date(2026, 4, 1), date(2026, 4, 30))
