from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    Index,
    Numeric,
    DateTime,
    func,
)
from sqlalchemy.orm import relationship
from app.db import Base


class Account(Base):
    __tablename__ = "accounts"
    __table_args__ = (
        Index("ix_accounts_user_id", "user_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # e.g., checking, savings, credit
    balance = Column(Numeric(14, 2), default=0)
    currency = Column(String, default="USD")
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="accounts")
    transactions = relationship("Transaction", back_populates="account")
