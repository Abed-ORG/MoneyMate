from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class SpendingInsightItem(BaseModel):
    category: str
    total: Decimal
    transaction_count: int
    percentage: float
    insight: str = ""


class SpendingInsightRequest(BaseModel):
    transactions: list[dict] = Field(default_factory=list)


class SpendingInsightResponse(BaseModel):
    summary: str
    top_category: str
    top_category_spend: Decimal = Decimal("0")
    insights: list[SpendingInsightItem] = Field(default_factory=list)
    provider: str = "heuristic"
    rationale: str = ""


class RecurringTransaction(BaseModel):
    vendor: str
    category: str
    amount: Decimal
    frequency: str = "monthly"
    confidence: float = 0.0
    last_detected: datetime | None = None
    transaction_ids: list[str] = Field(default_factory=list)


class RecurringDetectionResponse(BaseModel):
    recurring: list[RecurringTransaction]
    provider: str = "heuristic"
    rationale: str = ""


class AnomalyTransaction(BaseModel):
    transaction_id: str
    vendor: str
    amount: Decimal
    category: str
    date: datetime
    reason: str = ""
    severity: str = "medium"


class AnomalyDetectionResponse(BaseModel):
    anomalies: list[AnomalyTransaction]
    provider: str = "heuristic"
    rationale: str = ""


class MonthlySummaryResponse(BaseModel):
    summary: str
    provider: str = "heuristic"
    rationale: str = ""
