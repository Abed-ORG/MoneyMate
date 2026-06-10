from sqlalchemy import Column, Integer, String, ForeignKey, Numeric, DateTime, func
from sqlalchemy.orm import relationship
from app.db import Base
import datetime


class Budget(Base):
    __tablename__ = "budgets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    amount = Column(Numeric(14, 2), nullable=False)
    period = Column(String, nullable=False)  # e.g., monthly, yearly
    start_date = Column(DateTime, server_default=func.now())
    end_date = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="budgets")
    category = relationship("Category")
