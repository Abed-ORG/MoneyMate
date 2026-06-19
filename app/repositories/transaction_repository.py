from copy import deepcopy
from datetime import datetime, timezone
from uuid import uuid4

from app.schemas.transaction import (
    AiCategorization,
    Transaction,
    TransactionCreate,
    TransactionHistoryEvent,
    TransactionUpdate,
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def normalize_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def infer_ai_category(
    category: str,
    vendor: str,
    notes: str,
) -> AiCategorization:
    text = f"{category} {vendor} {notes}".lower()
    rules = [
        (
            "Food & Dining",
            ("coffee", "restaurant", "food", "dining", "grocery"),
        ),
        ("Transport", ("uber", "taxi", "fuel", "gas", "transport")),
        ("Housing", ("rent", "mortgage", "housing")),
        ("Income", ("salary", "payroll", "income")),
        ("Entertainment", ("netflix", "movie", "music", "entertainment")),
        ("Shopping", ("amazon", "store", "shopping")),
    ]
    for label, keywords in rules:
        if any(keyword in text for keyword in keywords):
            return AiCategorization(category=label, confidence=92)
    return AiCategorization(
        category=category or "Uncategorized",
        confidence=68,
    )


def make_history_event(event: str) -> TransactionHistoryEvent:
    return TransactionHistoryEvent(
        id=str(uuid4()),
        event=event,
        timestamp=utc_now(),
    )


class InMemoryTransactionRepository:
    def __init__(self) -> None:
        self._transactions: list[Transaction] = []

    def list_by_user(self, user_id: str) -> list[Transaction]:
        return [
            deepcopy(item)
            for item in self._transactions
            if item.user_id == user_id
        ]

    def get(self, user_id: str, transaction_id: str) -> Transaction | None:
        for transaction in self._transactions:
            if (
                transaction.id == transaction_id
                and transaction.user_id == user_id
            ):
                return deepcopy(transaction)
        return None

    def create(
        self,
        user_id: str,
        payload: TransactionCreate,
        event: str = "Transaction created",
    ) -> Transaction:
        now = utc_now()
        transaction = Transaction(
            id=str(uuid4()),
            user_id=user_id,
            date=normalize_datetime(payload.date),
            amount=payload.amount,
            category=payload.category,
            vendor=payload.vendor,
            notes=payload.notes,
            created_at=now,
            updated_at=now,
            ai_categorization=infer_ai_category(
                payload.category,
                payload.vendor,
                payload.notes,
            ),
            history=[make_history_event(event)],
        )
        self._transactions.insert(0, transaction)
        return deepcopy(transaction)

    def update(
        self,
        user_id: str,
        transaction_id: str,
        payload: TransactionUpdate,
    ) -> Transaction | None:
        values = payload.model_dump(exclude_unset=True)
        for index, transaction in enumerate(self._transactions):
            if (
                transaction.id != transaction_id
                or transaction.user_id != user_id
            ):
                continue
            updated = transaction.model_copy(update=values)
            updated.date = normalize_datetime(updated.date)
            updated.updated_at = utc_now()
            updated.ai_categorization = infer_ai_category(
                updated.category,
                updated.vendor,
                updated.notes,
            )
            updated.history = [
                *transaction.history,
                make_history_event("Transaction modified"),
            ]
            if transaction.notes != updated.notes and updated.notes:
                updated.history.append(
                    make_history_event(f'Added note "{updated.notes}"')
                )
            self._transactions[index] = updated
            return deepcopy(updated)
        return None

    def delete(self, user_id: str, transaction_id: str) -> bool:
        for index, transaction in enumerate(self._transactions):
            if (
                transaction.id == transaction_id
                and transaction.user_id == user_id
            ):
                del self._transactions[index]
                return True
        return False


transaction_repository = InMemoryTransactionRepository()
