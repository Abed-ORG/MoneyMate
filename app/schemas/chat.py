from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


ChatRole = Literal["user", "assistant"]
MessageStatus = Literal["complete", "assistant_failed"]


class ChatSource(BaseModel):
    type: str
    label: str
    start_date: str | None = None
    end_date: str | None = None


class ChatMessageRead(BaseModel):
    id: int
    conversation_id: int
    role: ChatRole
    content: str
    created_at: datetime
    sources: list[ChatSource] = Field(default_factory=list)
    metrics: dict[str, Any] = Field(default_factory=dict)
    status: MessageStatus = "complete"
    error_code: str | None = None


class ChatConversationRead(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime
    last_message_at: datetime | None = None
    last_message_preview: str | None = None
    message_count: int = 0


class ChatConversationListResponse(BaseModel):
    items: list[ChatConversationRead]
    total: int
    page: int
    page_size: int


class ChatConversationCreate(BaseModel):
    title: str | None = Field(None, max_length=120)

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str | None) -> str | None:
        if value is None:
            return value
        normalized = " ".join(value.split())
        return normalized or None


class ChatConversationUpdate(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str) -> str:
        normalized = " ".join(value.split())
        if not normalized:
            raise ValueError("Title is required.")
        return normalized


class ChatMessageCreate(BaseModel):
    question: str = Field(..., min_length=1, max_length=1200)

    @field_validator("question")
    @classmethod
    def normalize_question(cls, value: str) -> str:
        normalized = " ".join(value.split())
        if not normalized:
            raise ValueError("Question is required.")
        return normalized


class ChatMessagesResponse(BaseModel):
    items: list[ChatMessageRead]
    has_more: bool
    next_before_message_id: int | None = None


class ChatSendMessageResponse(BaseModel):
    conversation: ChatConversationRead
    user_message: ChatMessageRead
    assistant_message: ChatMessageRead


class ChatProviderFailureResponse(BaseModel):
    message: str
    retryable: bool = True
    user_message: ChatMessageRead
    conversation: ChatConversationRead
