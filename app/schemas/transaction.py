from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


class TransactionHistoryEvent(BaseModel):
    id: str
    event: str
    timestamp: datetime


class AiCategorization(BaseModel):
    category: str
    confidence: int = Field(..., ge=0, le=100)
    provider: str = "heuristic"
    rationale: str = ""


class TransactionBase(BaseModel):
    date: datetime
    amount: Decimal
    category: str = Field(..., min_length=1, max_length=80)
    vendor: str = Field("", max_length=120)
    notes: str = Field("", max_length=500)

    @field_validator("amount")
    @classmethod
    def amount_cannot_be_zero(cls, value: Decimal) -> Decimal:
        if value == 0:
            raise ValueError("Amount cannot be zero")
        return value

    @field_validator("category")
    @classmethod
    def normalize_category(cls, value: str) -> str:
        normalized = " ".join(value.split())
        if not normalized:
            raise ValueError("Category is required")
        return normalized

    @field_validator("vendor", "notes")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        return " ".join(value.split()) if value else ""


class TransactionCreate(TransactionBase):
    pass


class TransactionUpdate(BaseModel):
    date: Optional[datetime] = None
    amount: Optional[Decimal] = None
    category: Optional[str] = Field(None, min_length=1, max_length=80)
    vendor: Optional[str] = Field(None, max_length=120)
    notes: Optional[str] = Field(None, max_length=500)

    @field_validator("amount")
    @classmethod
    def amount_cannot_be_zero(
        cls,
        value: Optional[Decimal],
    ) -> Optional[Decimal]:
        if value == 0:
            raise ValueError("Amount cannot be zero")
        return value

    @field_validator("category")
    @classmethod
    def normalize_category(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        normalized = " ".join(value.split())
        if not normalized:
            raise ValueError("Category is required")
        return normalized

    @field_validator("vendor", "notes")
    @classmethod
    def normalize_text(cls, value: Optional[str]) -> Optional[str]:
        return " ".join(value.split()) if value else value


class Transaction(TransactionBase):
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime
    ai_categorization: AiCategorization
    history: list[TransactionHistoryEvent] = []


class CategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    color: str = Field("#49c5b6", min_length=4, max_length=16)
    is_default: bool = False

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        normalized = " ".join(value.split())
        if not normalized:
            raise ValueError("Category name is required")
        return normalized


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=80)
    color: Optional[str] = Field(None, min_length=4, max_length=16)
    is_default: Optional[bool] = None


class Category(CategoryBase):
    id: str
    user_id: str


class TransactionCorrectionRequest(BaseModel):
    category: str = Field(..., min_length=1, max_length=80)


class BulkRecategorizeRequest(BaseModel):
    transaction_ids: list[str] = Field(default_factory=list)


class TransactionSuggestionRequest(BaseModel):
    date: Optional[datetime] = None
    amount: Decimal
    vendor: str = Field("", max_length=120)
    notes: str = Field("", max_length=500)


class TransactionListResponse(BaseModel):
    items: list[Transaction]
    total: int
    page: int
    page_size: int


class TransactionBulkRequest(BaseModel):
    transactions: list[TransactionCreate]


class TransactionImportRequest(BaseModel):
    csv_content: str
    mapping: dict[str, str]


class TransactionImportError(BaseModel):
    row: int
    message: str


class TransactionImportResponse(BaseModel):
    imported: int
    failed: int
    errors: list[TransactionImportError]
    transactions: list[Transaction]


SortField = Literal["date", "amount", "category"]
SortDirection = Literal["asc", "desc"]
