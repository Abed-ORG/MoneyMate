from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class GoalContributionCreate(BaseModel):
    amount: Decimal = Field(..., gt=0)
    contributed_at: datetime | None = None
    note: str | None = Field(default=None, max_length=160)


class GoalContributionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    goal_id: int
    amount: Decimal
    contributed_at: datetime
    note: str | None


class GoalBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    target_amount: Decimal = Field(..., gt=0)
    deadline: date | None = None
    linked_account: str | None = Field(default=None, max_length=120)


class GoalCreate(GoalBase):
    current_amount: Decimal = Field(default=0, ge=0)


class GoalUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    target_amount: Decimal | None = Field(default=None, gt=0)
    deadline: date | None = None
    linked_account: str | None = Field(default=None, max_length=120)
    current_amount: Decimal | None = Field(default=None, ge=0)
    is_active: bool | None = None


class GoalRead(GoalBase):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: int
    user_id: int
    current_amount: Decimal
    is_active: bool
    deadline: date | None = Field(default=None, alias="target_date")
    contributions: list[GoalContributionRead] = Field(default_factory=list)
    saved_percentage: float = 0
    remaining_amount: Decimal = Decimal("0")


class GoalListResponse(BaseModel):
    items: list[GoalRead]


class GoalAICalculationRequest(BaseModel):
    goal_id: int | None = None
    target_amount: Decimal
    current_amount: Decimal = Decimal("0")
    deadline: date | None = None
    monthly_contribution: Decimal | None = None


class GoalAICalculationResponse(BaseModel):
    required_monthly: Decimal
    provider: str = "heuristic"
    rationale: str = ""


class GoalProjectionPoint(BaseModel):
    month: str
    projected: Decimal


class GoalProjectionResponse(BaseModel):
    projections: list[GoalProjectionPoint]
    provider: str = "heuristic"
    rationale: str = ""