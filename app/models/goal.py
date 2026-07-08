from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    Numeric,
    DateTime,
    Boolean,
    Text,
)
from sqlalchemy.orm import relationship
from app.db import Base


class Goal(Base):
    __tablename__ = "goals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    target_amount = Column(Numeric(14, 2), nullable=False)
    current_amount = Column(Numeric(14, 2), default=0)
    start_date = Column(DateTime, nullable=True)
    target_date = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    linked_account = Column(String, nullable=True)

    user = relationship("User", back_populates="goals")
    contributions = relationship(
        "GoalContribution",
        back_populates="goal",
        cascade="all, delete-orphan",
        order_by="GoalContribution.contributed_at",
    )


class GoalContribution(Base):
    __tablename__ = "goal_contributions"

    id = Column(Integer, primary_key=True, index=True)
    goal_id = Column(Integer, ForeignKey("goals.id"), nullable=False)
    amount = Column(Numeric(14, 2), nullable=False)
    contributed_at = Column(DateTime, nullable=False)
    note = Column(Text, nullable=True)

    goal = relationship("Goal", back_populates="contributions")
