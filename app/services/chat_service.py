from __future__ import annotations

import re
from difflib import SequenceMatcher
from datetime import datetime, timezone
from typing import Any

from fastapi.encoders import jsonable_encoder
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
CONTEXTUAL_FOLLOWUP_WORDS = {
    "about",
    "biggest",
    "compare",
    "highest",
    "least",
    "lowest",
    "same",
    "smallest",
    "that",
    "them",
    "these",
    "this",
    "those",
    "top",
    "what",
    "why",
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
FINANCE_TOKEN_SIMILARITY = 0.84


class ChatNotFoundError(Exception):
    pass


class ChatProviderUnavailableError(Exception):
    def __init__(
        self,
        message: str,
        conversation: ChatConversationRead,
        user_message: ChatMessageRead,
        retryable: bool = True,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.conversation = conversation
        self.user_message = user_message
        self.retryable = retryable

    def detail(self) -> dict[str, Any]:
        return jsonable_encoder(
            {
                "message": self.message,
                "retryable": self.retryable,
                "conversation": self.conversation,
                "user_message": self.user_message,
            }
        )


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


def is_finance_question(question: str) -> bool:
    text = normalize_social_text(question)
    if any(keyword in text for keyword in FINANCE_KEYWORDS):
        return True
    words = text.replace("'", "").split()
    for word in words:
        if len(word) < 4:
            continue
        if any(
            SequenceMatcher(None, word, keyword).ratio()
            >= FINANCE_TOKEN_SIMILARITY
            for keyword in FINANCE_KEYWORDS
        ):
            return True
    return False


def normalize_social_text(question: str) -> str:
    text = question.casefold()
    text = re.sub(r"[^a-z0-9\s']", " ", text)
    text = re.sub(r"(.)\1{2,}", r"\1", text)
    return " ".join(text.split())


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


def is_contextual_finance_followup(
    question: str,
    history: list[dict[str, str]],
) -> bool:
    text = normalize_social_text(question)
    if not text or len(text) > 160 or is_finance_question(text):
        return False
    words = set(text.replace("'", "").split())
    if not words.intersection(CONTEXTUAL_FOLLOWUP_WORDS):
        return False
    return any(is_finance_question(message["content"]) for message in history[-4:])


def resolve_contextual_finance_followup(
    question: str,
    history: list[dict[str, str]],
) -> str:
    recent_messages = [
        f"{message['role']}: {message['content']}"
        for message in history[-4:]
    ]
    recent_text = "\n".join(recent_messages)
    return (
        "Use the same MoneyMate financial topic and date period from this "
        "recent conversation to answer the follow-up.\n"
        f"{recent_text}\n"
        f"Follow-up: {question}"
    )


def context_for_gemini(
    context: dict,
    history: list[dict[str, str]],
) -> dict:
    if not history:
        return context
    return {**context, "conversation_history": history}


def general_chat_context(history: list[dict[str, str]]) -> dict[str, Any]:
    context: dict[str, Any] = {
        "mode": "general_conversation",
        "assistant": "MoneyMate",
        "allowed_scope": [
            "friendly greetings",
            "thanks and farewells",
            "brief MoneyMate capability questions",
            "polite redirection for requests outside MoneyMate finance",
        ],
    }
    if history:
        context["conversation_history"] = history
    return context


def build_chat_context(
    db: Session,
    user_id: int,
    question: str,
    history: list[dict[str, str]],
) -> tuple[dict[str, Any], str, list[dict[str, Any]], dict[str, Any]]:
    effective_question = resolve_followup_question(question, history)
    if not is_finance_question(effective_question) and (
        is_contextual_finance_followup(question, history)
    ):
        effective_question = resolve_contextual_finance_followup(
            question,
            history,
        )
    if is_finance_question(effective_question):
        context = build_financial_context(db, user_id, effective_question)
        return (
            context_for_gemini(context, history),
            "smart",
            sources_from_context(context),
            metrics_from_context(context),
        )
    return general_chat_context(history), "simple", [], {}


def mark_user_message_failed(
    db: Session,
    conversation: ChatConversation,
    user_message: ChatMessage,
    exc: GeminiChatError,
) -> None:
    user_message.status = "assistant_failed"
    user_message.error_code = exc.code
    conversation.updated_at = utc_now()
    db.commit()
    db.refresh(user_message)
    db.refresh(conversation)


def raise_provider_unavailable(
    db: Session,
    conversation: ChatConversation,
    user_message: ChatMessage,
    exc: GeminiChatError,
) -> None:
    mark_user_message_failed(db, conversation, user_message, exc)
    raise ChatProviderUnavailableError(
        "MoneyMate AI is temporarily unavailable. Please retry in a moment.",
        conversation_to_schema(db, conversation),
        message_to_schema(user_message),
    ) from exc


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
    context, tier, sources, metrics = build_chat_context(
        db,
        user_id,
        question,
        history,
    )
    try:
        answer = gemini_chat_client.generate_answer(
            question,
            context,
            tier=tier,
        )
    except GeminiChatError as exc:
        raise_provider_unavailable(db, conversation, user_message, exc)

    assistant = add_assistant_message(
        db,
        conversation,
        answer,
        sources,
        metrics,
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
    context, tier, sources, metrics = build_chat_context(
        db,
        user_id,
        user_message.content,
        history,
    )
    try:
        answer = gemini_chat_client.generate_answer(
            user_message.content,
            context,
            tier=tier,
        )
    except GeminiChatError as exc:
        raise_provider_unavailable(db, conversation, user_message, exc)

    user_message.status = "complete"
    user_message.error_code = None
    assistant = add_assistant_message(
        db,
        conversation,
        answer,
        sources,
        metrics,
    )
    db.commit()
    db.refresh(user_message)
    return ChatSendMessageResponse(
        conversation=conversation_to_schema(db, conversation),
        user_message=message_to_schema(user_message),
        assistant_message=message_to_schema(assistant),
    )
