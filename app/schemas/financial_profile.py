from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class SavingsGoal(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    target_amount: Decimal = Field(..., gt=0)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        return " ".join(value.split())


class FinancialProfilePayload(BaseModel):
    monthly_income: Decimal = Field(..., ge=0)
    currency: str = Field(..., min_length=3, max_length=3)
    spending_categories: List[str] = Field(default_factory=list)
    savings_goals: List[SavingsGoal] = Field(default_factory=list)

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        return value.upper()

    @field_validator("spending_categories")
    @classmethod
    def normalize_categories(cls, values: List[str]) -> List[str]:
        normalized = []
        for value in values:
            category = " ".join(value.split())
            if category and category not in normalized:
                normalized.append(category)
        return normalized


class FinancialProfileUpdate(BaseModel):
    monthly_income: Optional[Decimal] = Field(None, ge=0)
    currency: Optional[str] = Field(None, min_length=3, max_length=3)
    spending_categories: Optional[List[str]] = None
    savings_goals: Optional[List[SavingsGoal]] = None

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: Optional[str]) -> Optional[str]:
        return value.upper() if value else value

    @field_validator("spending_categories")
    @classmethod
    def normalize_categories(
        cls, values: Optional[List[str]]
    ) -> Optional[List[str]]:
        if values is None:
            return values
        normalized = []
        for value in values:
            category = " ".join(value.split())
            if category and category not in normalized:
                normalized.append(category)
        return normalized


class FinancialProfile(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    monthly_income: Optional[Decimal]
    currency: str
    spending_categories: List[str]
    savings_goals: List[SavingsGoal]
    onboarding_completed: bool
    onboarding_skipped: bool


class MonthlyIncomeHistoryResponse(BaseModel):
    monthly_income_by_month: dict[str, Decimal]
