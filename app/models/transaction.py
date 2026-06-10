from sqlalchemy import Column, Integer, String, ForeignKey, Numeric, DateTime, Boolean, func
from sqlalchemy.orm import relationship
from app.db import Base
import datetime


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    amount = Column(Numeric(14, 2), nullable=False)
    description = Column(String, nullable=True)
    occurred_at = Column(DateTime, server_default=func.now())
    is_transfer = Column(Boolean, default=False)
    # direction/type: 'income' or 'expense' (nullable for legacy entries)
    type = Column(String, nullable=True)

    account = relationship("Account", back_populates="transactions")
    category = relationship("Category", back_populates="transactions")
