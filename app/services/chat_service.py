from __future__ import annotations

import re
from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.chat_history import ChatConversation, ChatMessage
from app.schemas.chat import (
    ChatConversationCreate,
    ChatConversationListResponse,
    ChatConversationRead,
    ChatConversationUpdate,
    ChatMessageRead,
    ChatMessagesResponse,
    ChatSendMessageResponse,
)
from app.services.chat_context_service import (
    build_financial_context,
    metrics_from_context,
    sources_from_context,
)
from app.services.chat_gemini_service import (
    GeminiChatError,
    gemini_chat_client,
)


MAX_QUESTION_LENGTH = 1200
RECENT_HISTORY_LIMIT = 8
FINANCE_KEYWORDS = {
    "account",
    "balance",
    "budget",
    "category",
    "expense",
    "food",
    "goal",
    "groceries",
    "income",
    "money",
    "net",
    "saving",
    "savings",
    "spend",
    "spent",
    "transaction",
}
SOCIAL_MESSAGE_WORDS = {
    "afternoon",
    "are",
    "bye",
    "doing",
    "evening",
    "good",
    "goodbye",
    "hello",
    "help",
    "hey",
    "hi",
    "morning",
    "night",
    "ok",
    "okay",
    "thanks",
    "thank",
    "there",
    "yo",
    "you",
}
SOCIAL_MESSAGE_PHRASES = {
    "good afternoon",
    "good evening",
    "good morning",
    "hello",
    "hey",
    "hi",
    "how are you",
    "thanks",
    "thank you",
    "whats up",
}
AFFIRMATIVE_REPLIES = {
    "absolutely",
    "ok",
    "okay",
    "please",
    "sure",
    "sure please",
    "yeah",
    "yep",
    "yes",
    "yes please",
    "yesplease",
}


class ChatNotFoundError(Exception):
    pass


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def normalize_text(value: str) -> str:
    return " ".join(value.split())


def title_from_question(question: str) -> str:
    title = normalize_text(question)
    if len(title) <= 58:
        return title or "New conversation"
    return f"{title[:55].rstrip()}..."


def message_to_schema(message: ChatMessage) -> ChatMessageRead:
    return ChatMessageRead(
        id=message.id,
        conversation_id=message.conversation_id,
        role=message.role,
        content=message.content,
        created_at=message.created_at,
        sources=message.sources or [],
        metrics=message.metrics or {},
        status=message.status,
        error_code=message.error_code,
    )


def conversation_preview(db: Session, conversation_id: int) -> str | None:
    message = (
        db.query(ChatMessage)
        .filter(ChatMessage.conversation_id == conversation_id)
        .order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc())
        .first()
    )
    if not message:
        return None
    preview = normalize_text(message.content)
    return preview[:96]


def conversation_to_schema(
    db: Session,
    conversation: ChatConversation,
) -> ChatConversationRead:
    count = (
        db.query(func.count(ChatMessage.id))
        .filter(ChatMessage.conversation_id == conversation.id)
        .scalar()
        or 0
    )
    return ChatConversationRead(
        id=conversation.id,
        title=conversation.title,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
        last_message_at=conversation.last_message_at,
        last_message_preview=conversation_preview(db, conversation.id),
        message_count=count,
    )


def get_conversation(
    db: Session,
    user_id: int,
    conversation_id: int,
) -> ChatConversation:
    conversation = (
        db.query(ChatConversation)
        .filter(
            ChatConversation.id == conversation_id,
            ChatConversation.user_id == user_id,
            ChatConversation.is_archived.is_(False),
        )
        .first()
    )
    if not conversation:
        raise ChatNotFoundError
    return conversation


def create_conversation(
    db: Session,
    user_id: int,
    payload: ChatConversationCreate | None = None,
) -> ChatConversationRead:
    title = payload.title if payload and payload.title else "New conversation"
    now = utc_now()
    conversation = ChatConversation(
        user_id=user_id,
        title=title,
        created_at=now,
        updated_at=now,
        last_message_at=now,
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation_to_schema(db, conversation)


def list_conversations(
    db: Session,
    user_id: int,
    page: int,
    page_size: int,
) -> ChatConversationListResponse:
    query = db.query(ChatConversation).filter(
        ChatConversation.user_id == user_id,
        ChatConversation.is_archived.is_(False),
    )
    total = query.count()
    items = (
        query.order_by(
            ChatConversation.last_message_at.desc(),
            ChatConversation.id.desc(),
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return ChatConversationListResponse(
        items=[conversation_to_schema(db, item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


def list_messages(
    db: Session,
    user_id: int,
    conversation_id: int,
    limit: int,
    before_message_id: int | None = None,
) -> ChatMessagesResponse:
    get_conversation(db, user_id, conversation_id)
    query = db.query(ChatMessage).filter(
        ChatMessage.conversation_id == conversation_id
    )
    if before_message_id is not None:
        query = query.filter(ChatMessage.id < before_message_id)
    rows = (
        query.order_by(ChatMessage.id.desc())
        .limit(limit + 1)
        .all()
    )
    has_more = len(rows) > limit
    visible = list(reversed(rows[:limit]))
    return ChatMessagesResponse(
        items=[message_to_schema(message) for message in visible],
        has_more=has_more,
        next_before_message_id=(
            visible[0].id if has_more and visible else None
        ),
    )


def rename_conversation(
    db: Session,
    user_id: int,
    conversation_id: int,
    payload: ChatConversationUpdate,
) -> ChatConversationRead:
    conversation = get_conversation(db, user_id, conversation_id)
    conversation.title = payload.title
    conversation.updated_at = utc_now()
    db.commit()
    db.refresh(conversation)
    return conversation_to_schema(db, conversation)


def archive_conversation(
    db: Session,
    user_id: int,
    conversation_id: int,
) -> None:
    conversation = get_conversation(db, user_id, conversation_id)
    conversation.is_archived = True
    conversation.updated_at = utc_now()
    db.commit()


def add_user_message(
    db: Session,
    conversation: ChatConversation,
    question: str,
) -> ChatMessage:
    message = ChatMessage(
        conversation_id=conversation.id,
        role="user",
        content=question,
        status="complete",
        created_at=utc_now(),
    )
    db.add(message)
    conversation.last_message_at = message.created_at
    conversation.updated_at = message.created_at
    if conversation.title == "New conversation":
        conversation.title = title_from_question(question)
    db.commit()
    db.refresh(message)
    db.refresh(conversation)
    return message


def add_assistant_message(
    db: Session,
    conversation: ChatConversation,
    content: str,
    sources: list[dict],
    metrics: dict,
) -> ChatMessage:
    message = ChatMessage(
        conversation_id=conversation.id,
        role="assistant",
        content=content,
        sources=sources,
        metrics=metrics,
        status="complete",
        created_at=utc_now(),
    )
    db.add(message)
    conversation.last_message_at = message.created_at
    conversation.updated_at = message.created_at
    db.commit()
    db.refresh(message)
    db.refresh(conversation)
    return message


def recent_conversation_history(
    db: Session,
    conversation_id: int,
    before_message_id: int | None = None,
    limit: int = RECENT_HISTORY_LIMIT,
) -> list[dict[str, str]]:
    query = db.query(ChatMessage).filter(
        ChatMessage.conversation_id == conversation_id
    )
    if before_message_id is not None:
        query = query.filter(ChatMessage.id < before_message_id)
    messages = (
        query.order_by(ChatMessage.id.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "role": message.role,
            "content": normalize_text(message.content)[:700],
        }
        for message in reversed(messages)
    ]


def format_money(value: float | int | None, currency: str) -> str:
    amount = float(value or 0)
    return f"{amount:,.2f} {currency}"


def is_finance_question(question: str) -> bool:
    text = question.casefold()
    return any(keyword in text for keyword in FINANCE_KEYWORDS)


def normalize_social_text(question: str) -> str:
    text = question.casefold()
    text = re.sub(r"[^a-z0-9\s']", " ", text)
    text = re.sub(r"(.)\1{2,}", r"\1", text)
    return " ".join(text.split())


def is_social_message(question: str) -> bool:
    text = normalize_social_text(question)
    if not text or len(text) > 120 or is_finance_question(question):
        return False
    if text in SOCIAL_MESSAGE_PHRASES:
        return True
    words = text.replace("'", "").split()
    return bool(words) and all(word in SOCIAL_MESSAGE_WORDS for word in words)


def social_answer(question: str) -> str:
    text = normalize_social_text(question)
    if "thank" in text or "thanks" in text:
        return "You're welcome! I'm here whenever you need me."
    if "bye" in text or "goodbye" in text:
        return "Bye for now! I'll be here when you want to chat again."
    return (
        "Hi! I'm here and happy to help. What would you like to look at today?"
    )


def is_affirmative_reply(question: str) -> bool:
    return normalize_social_text(question) in AFFIRMATIVE_REPLIES


def last_assistant_message(history: list[dict[str, str]]) -> str:
    for message in reversed(history):
        if message["role"] == "assistant":
            return message["content"]
    return ""


def resolve_followup_question(
    question: str,
    history: list[dict[str, str]],
) -> str:
    if not is_affirmative_reply(question):
        return question

    previous_assistant = last_assistant_message(history).casefold()
    if "would you like" not in previous_assistant:
        return question
    if not any(
        word in previous_assistant
        for word in [
            "spending",
            "budget",
            "savings",
            "goal",
            "net position",
            "finances",
            "period",
        ]
    ):
        return question
    return (
        "Tell me more about my spending, budgets, savings goals, and net "
        "position for the available period."
    )


def context_for_gemini(
    context: dict,
    history: list[dict[str, str]],
) -> dict:
    if not history:
        return context
    return {**context, "conversation_history": history}


def fallback_answer(
    question: str,
    context: dict,
    _exc: GeminiChatError,
    history: list[dict[str, str]] | None = None,
) -> str:
    history = history or []
    if is_social_message(question):
        return social_answer(question)

    effective_question = resolve_followup_question(question, history)
    if not is_finance_question(effective_question):
        return (
            "Sorry, I can help with MoneyMate finance questions like "
            "spending, budgets, savings goals, and net position. Try asking "
            "me something like **How much did I spend this month?**"
        )

    currency = context.get("currency", "USD")
    period = context.get("period", {})
    transactions = context.get("transactions", {})
    categories = transactions.get("category_totals") or []
    period_label = period.get("label", "this period")
    question_text = effective_question.casefold()
    transaction_count = int(transactions.get("transaction_count") or 0)

    if not transaction_count:
        return (
            f"I don't have any transactions for **{period_label}** yet, so "
            "I can't calculate that accurately. Once you add transactions, "
            "I can help you review your spending, budgets, and savings goals."
        )

    if "category" in question_text and any(
        word in question_text for word in ["most", "highest", "top", "biggest"]
    ):
        if not categories:
            return (
                f"I don't see any expenses recorded for **{period_label}** "
                "yet, so there isn't a top spending category to show."
            )
        top_category = categories[0]
        return (
            f"For **{period_label}**, you spent the most on "
            f"**{top_category['category']}**: "
            f"**{format_money(top_category['total'], currency)}** "
            f"({top_category['percentage_of_expenses']:.0f}% "
            "of your expenses)."
        )

    if any(word in question_text for word in ["budget", "within", "over"]):
        budgets = context.get("budgets") or []
        if not budgets:
            return (
                f"I don't see any budgets set for **{period_label}** yet. "
                "Add a category budget and I can track whether you are "
                "on pace."
            )
        over_budget = [item for item in budgets if item["remaining"] < 0]
        if over_budget:
            names = ", ".join(item["category"] for item in over_budget[:2])
            return (
                f"For **{period_label}**, you are over budget in **{names}**. "
                "Your total spending is "
                f"**{format_money(transactions.get('expenses'), currency)}**."
            )
        return (
            f"You are currently within all of your budgets for "
            f"**{period_label}**. Your spending so far is "
            f"**{format_money(transactions.get('expenses'), currency)}**."
        )

    if any(word in question_text for word in ["goal", "saving", "savings"]):
        goals = context.get("goals") or []
        if not goals:
            return (
                "You don't have an active savings goal yet. Add one and I "
                "can help you track its progress."
            )
        goal = goals[0]
        return (
            f"Your **{goal['name']}** goal is "
            f"**{goal['progress_percentage']:.0f}%** complete: "
            f"**{format_money(goal['current_amount'], currency)}** saved and "
            f"**{format_money(goal['remaining_amount'], currency)}** "
            "remaining."
        )

    if any(word in question_text for word in ["income", "earn"]):
        return (
            f"For **{period_label}**, your income is "
            f"**{format_money(transactions.get('income'), currency)}**."
        )

    if any(word in question_text for word in ["net", "position", "balance"]):
        return (
            f"For **{period_label}**, your net position is "
            f"**{format_money(transactions.get('net_amount'), currency)}** "
            f"from **{format_money(transactions.get('income'), currency)}** "
            "income and "
            f"**{format_money(transactions.get('expenses'), currency)}** "
            "expenses."
        )

    if any(word in question_text for word in ["spend", "spent", "expense"]):
        return (
            f"For **{period_label}**, you spent "
            f"**{format_money(transactions.get('expenses'), currency)}** "
            f"across **{transaction_count}** transactions."
        )

    lines = [
        (
            f"Based on your MoneyMate data for **{period_label}**, income was "
            f"**{format_money(transactions.get('income'), currency)}**, "
            "expenses were "
            f"**{format_money(transactions.get('expenses'), currency)}**, "
            "and net was "
            f"**{format_money(transactions.get('net_amount'), currency)}**."
        )
    ]
    if categories:
        top_category = categories[0]
        lines.append(
            f"Your top spending category was **{top_category['category']}** "
            f"at **{format_money(top_category['total'], currency)}**."
        )

    return "\n\n".join(lines)


def send_message(
    db: Session,
    user_id: int,
    conversation_id: int,
    question: str,
) -> ChatSendMessageResponse:
    if len(question) > MAX_QUESTION_LENGTH:
        raise ValueError("Question is too long.")
    conversation = get_conversation(db, user_id, conversation_id)
    user_message = add_user_message(db, conversation, question)
    history = recent_conversation_history(db, conversation.id, user_message.id)
    effective_question = resolve_followup_question(question, history)
    if is_social_message(question):
        answer = social_answer(question)
        assistant = add_assistant_message(db, conversation, answer, [], {})
        return ChatSendMessageResponse(
            conversation=conversation_to_schema(db, conversation),
            user_message=message_to_schema(user_message),
            assistant_message=message_to_schema(assistant),
        )

    context = build_financial_context(db, user_id, effective_question)
    try:
        answer = gemini_chat_client.generate_answer(
            question,
            context_for_gemini(context, history),
        )
    except GeminiChatError as exc:
        answer = fallback_answer(question, context, exc, history)

    assistant = add_assistant_message(
        db,
        conversation,
        answer,
        sources_from_context(context),
        metrics_from_context(context),
    )
    return ChatSendMessageResponse(
        conversation=conversation_to_schema(db, conversation),
        user_message=message_to_schema(user_message),
        assistant_message=message_to_schema(assistant),
    )


def retry_message(
    db: Session,
    user_id: int,
    conversation_id: int,
    message_id: int,
) -> ChatSendMessageResponse:
    conversation = get_conversation(db, user_id, conversation_id)
    user_message = (
        db.query(ChatMessage)
        .filter(
            ChatMessage.id == message_id,
            ChatMessage.conversation_id == conversation.id,
            ChatMessage.role == "user",
        )
        .first()
    )
    if not user_message:
        raise ChatNotFoundError
    history = recent_conversation_history(db, conversation.id, user_message.id)
    effective_question = resolve_followup_question(
        user_message.content,
        history,
    )
    if is_social_message(user_message.content):
        user_message.status = "complete"
        user_message.error_code = None
        assistant = add_assistant_message(
            db,
            conversation,
            social_answer(user_message.content),
            [],
            {},
        )
        db.commit()
        db.refresh(user_message)
        return ChatSendMessageResponse(
            conversation=conversation_to_schema(db, conversation),
            user_message=message_to_schema(user_message),
            assistant_message=message_to_schema(assistant),
        )

    context = build_financial_context(db, user_id, effective_question)
    try:
        answer = gemini_chat_client.generate_answer(
            user_message.content,
            context_for_gemini(context, history),
        )
    except GeminiChatError as exc:
        answer = fallback_answer(user_message.content, context, exc, history)

    user_message.status = "complete"
    user_message.error_code = None
    assistant = add_assistant_message(
        db,
        conversation,
        answer,
        sources_from_context(context),
        metrics_from_context(context),
    )
    db.commit()
    db.refresh(user_message)
    return ChatSendMessageResponse(
        conversation=conversation_to_schema(db, conversation),
        user_message=message_to_schema(user_message),
        assistant_message=message_to_schema(assistant),
    )
