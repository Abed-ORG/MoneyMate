from sqlalchemy import (
    Column,
    Date,
    ForeignKey,
    Integer,
    Numeric,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.db import Base


class MonthlyIncomeHistory(Base):
    __tablename__ = "monthly_income_history"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "effective_month",
            name="uq_monthly_income_history_user_month",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    effective_month = Column(Date, nullable=False, index=True)
    monthly_income = Column(Numeric(14, 2), nullable=False)

    user = relationship("User", back_populates="monthly_income_history")
