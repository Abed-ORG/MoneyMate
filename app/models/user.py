from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy.orm import relationship
from app.db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String(255), nullable=False)
    is_email_verified = Column(Boolean, nullable=False, default=False)
    email_verified_at = Column(DateTime(timezone=True), nullable=True)

    financial_profile = relationship(
        "FinancialProfile",
        back_populates="user",
        cascade="all, delete-orphan",
        uselist=False,
    )
