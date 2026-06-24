from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel


TrendAggregation = Literal["daily", "weekly"]
ChangeDirection = Literal[
    "increase",
    "decrease",
    "flat",
    "new",
    "no_previous_data",
]


class AnalyticsPeriod(BaseModel):
    start_date: date
    end_date: date


class AnalyticsTotals(BaseModel):
    total_income: Decimal
    total_expenses: Decimal
    net_amount: Decimal


class AnalyticsPercentageChange(BaseModel):
    value: Decimal | None = None
    label: str
    direction: ChangeDirection


class NetPositionSummary(BaseModel):
    current: AnalyticsTotals
    previous: AnalyticsTotals
    net_change: AnalyticsPercentageChange


class SpendingCategoryAnalytics(BaseModel):
    category_id: int | None = None
    category_name: str
    color: str
    amount: Decimal
    percentage: Decimal


class MonthlyIncomeExpense(BaseModel):
    month: str
    month_label: str
    income: Decimal
    expenses: Decimal
    net: Decimal


class SpendingTrendPoint(BaseModel):
    key: str
    label: str
    start_date: date
    end_date: date
    spending: Decimal
    moving_average: Decimal


class AnalyticsFilterCategory(BaseModel):
    id: int
    name: str
    color: str


class AnalyticsFilterAccount(BaseModel):
    id: int
    name: str
    type: str
    currency: str


class AnalyticsFilters(BaseModel):
    categories: list[AnalyticsFilterCategory]
    accounts: list[AnalyticsFilterAccount]


class DashboardAnalyticsResponse(BaseModel):
    currency: str
    period: AnalyticsPeriod
    previous_period: AnalyticsPeriod
    summary: NetPositionSummary
    spending_by_category: list[SpendingCategoryAnalytics]
    monthly_income_expenses: list[MonthlyIncomeExpense]
    spending_trend: list[SpendingTrendPoint]
    filters: AnalyticsFilters
