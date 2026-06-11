from sqlalchemy import (
    Boolean,
    Column,
    ForeignKey,
    Integer,
    JSON,
    Numeric,
    String,
)
from sqlalchemy.orm import relationship

from app.db import Base


class FinancialProfile(Base):
    __tablename__ = "financial_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    monthly_income = Column(Numeric(14, 2), nullable=True)
    currency = Column(String(3), nullable=False, default="USD")
    spending_categories = Column(JSON, nullable=False, default=list)
    savings_goals = Column(JSON, nullable=False, default=list)
    onboarding_completed = Column(Boolean, nullable=False, default=False)
    onboarding_skipped = Column(Boolean, nullable=False, default=False)

    user = relationship("User", back_populates="financial_profile")
