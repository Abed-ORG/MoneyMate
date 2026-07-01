from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


AlertLevel = Literal["warning", "alert"]
BudgetStatus = Literal[
    "under_budget",
    "close_to_budget",
    "on_budget",
    "over_budget",
]
ProgressState = Literal["green", "yellow", "red"]
TrendDirection = Literal["improvement", "decline", "no_change"]


class BudgetCategory(BaseModel):
    id: int
    name: str
    icon: str | None = None
    color: str | None = None


class BudgetBase(BaseModel):
    category_id: int | None = None
    category_name: str | None = Field(None, min_length=1, max_length=80)
    amount: Decimal = Field(..., gt=0, max_digits=14, decimal_places=2)
    month: int = Field(..., ge=1, le=12)
    year: int = Field(..., ge=1900, le=2200)

    @field_validator("amount")
    @classmethod
    def amount_must_be_positive(cls, value: Decimal) -> Decimal:
        if value <= 0:
            raise ValueError("Amount must be greater than zero.")
        return value

    @field_validator("category_name")
    @classmethod
    def normalize_category_name(cls, value: str | None) -> str | None:
        if value is None:
            return value
        normalized = " ".join(value.split())
        if not normalized:
            raise ValueError("Category name is required.")
        return normalized


class BudgetCreate(BudgetBase):
    pass


class BudgetUpdate(BaseModel):
    category_id: int | None = None
    category_name: str | None = Field(None, min_length=1, max_length=80)
    amount: Decimal | None = Field(None, gt=0, max_digits=14, decimal_places=2)
    month: int | None = Field(None, ge=1, le=12)
    year: int | None = Field(None, ge=1900, le=2200)

    @field_validator("amount")
    @classmethod
    def amount_must_be_positive(cls, value: Decimal | None) -> Decimal | None:
        if value is not None and value <= 0:
            raise ValueError("Amount must be greater than zero.")
        return value

    @field_validator("category_name")
    @classmethod
    def normalize_category_name(cls, value: str | None) -> str | None:
        if value is None:
            return value
        normalized = " ".join(value.split())
        if not normalized:
            raise ValueError("Category name is required.")
        return normalized


class BudgetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    category_id: int
    amount: Decimal
    month: int
    year: int
    category_name: str
    category_icon: str | None = None
    category_color: str | None = None


class BudgetAlert(BaseModel):
    severity: AlertLevel
    category_id: int
    category_name: str
    category_icon: str | None = None
    category_color: str | None = None
    budgeted_amount: Decimal
    actual_spending: Decimal
    remaining_amount: Decimal
    usage_percentage: Decimal
    message: str


class BudgetCategorySummary(BaseModel):
    budget_id: int
    category_id: int
    category_name: str
    category_icon: str | None = None
    category_color: str | None = None
    budgeted_amount: Decimal
    actual_spending: Decimal
    remaining_amount: Decimal
    usage_percentage: Decimal
    variance_amount: Decimal
    variance_percentage: Decimal
    status: BudgetStatus
    alert_level: AlertLevel | None = None
    progress_state: ProgressState


class BudgetTotals(BaseModel):
    total_budgeted_amount: Decimal
    total_actual_spending: Decimal
    total_remaining_amount: Decimal
    overall_usage_percentage: Decimal
    categories_over_budget: int


class BudgetOverview(BaseModel):
    month: int
    year: int
    currency: str
    totals: BudgetTotals
    budgets: list[BudgetCategorySummary]
    alerts: list[BudgetAlert]


class BudgetHistoryMonth(BaseModel):
    month: int
    year: int
    month_label: str
    total_budgeted_amount: Decimal
    total_actual_spending: Decimal
    overall_usage_percentage: Decimal
    adherence_percentage: Decimal
    categories_within_budget: int
    categories_over_budget: int
    trend: TrendDirection
    trend_percentage_points: Decimal
    trend_message: str


class BudgetHistoryResponse(BaseModel):
    months: list[BudgetHistoryMonth]
