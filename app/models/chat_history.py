from sqlalchemy import (
    Boolean,
    Column,
    Integer,
    String,
    ForeignKey,
    DateTime,
    JSON,
    Text,
    func,
    Index,
)
from sqlalchemy.orm import relationship
from app.db import Base


class ChatHistory(Base):
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(String, nullable=False)  # user, assistant, system
    message = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="chat_history")


class ChatConversation(Base):
    __tablename__ = "chat_conversations"
    __table_args__ = (
        Index(
            "ix_chat_conversations_user_last_message",
            "user_id",
            "last_message_at",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(120), nullable=False, default="New conversation")
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    last_message_at = Column(DateTime, server_default=func.now())
    is_archived = Column(Boolean, nullable=False, default=False)

    user = relationship("User", back_populates="chat_conversations")
    messages = relationship(
        "ChatMessage",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="ChatMessage.created_at, ChatMessage.id",
    )


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    __table_args__ = (
        Index(
            "ix_chat_messages_conversation_created",
            "conversation_id",
            "created_at",
            "id",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(
        Integer,
        ForeignKey("chat_conversations.id"),
        nullable=False,
    )
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    sources = Column(JSON, nullable=True)
    metrics = Column(JSON, nullable=True)
    status = Column(String(20), nullable=False, default="complete")
    error_code = Column(String(80), nullable=True)

    conversation = relationship("ChatConversation", back_populates="messages")
