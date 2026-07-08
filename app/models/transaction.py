from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    Numeric,
    DateTime,
    Boolean,
    Index,
    JSON,
    Text,
    func,
)
from sqlalchemy.orm import relationship
from app.db import Base


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (
        Index("ix_transactions_account_occurred_at", "account_id", "occurred_at"),
        Index("ix_transactions_category_occurred_at", "category_id", "occurred_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    amount = Column(Numeric(14, 2), nullable=False)
    description = Column(String, nullable=True)
    vendor = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    occurred_at = Column(DateTime, server_default=func.now())
    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    is_transfer = Column(Boolean, default=False)
    # direction/type: 'income' or 'expense' (nullable for legacy entries)
    type = Column(String, nullable=True)
    ai_category = Column(String, nullable=True)
    ai_confidence = Column(Integer, nullable=True)
    ai_provider = Column(String, nullable=True)
    ai_rationale = Column(Text, nullable=True)
    history = Column(JSON, nullable=True)

    account = relationship("Account", back_populates="transactions")
    category = relationship("Category", back_populates="transactions")
