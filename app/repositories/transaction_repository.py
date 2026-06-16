from copy import deepcopy
from datetime import datetime, timezone
from decimal import Decimal
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
        self._seed()

    def _seed(self) -> None:
        if self._transactions:
            return
        seed_user_id = "dev-user-1"
        samples = [
            (
                "2026-06-10T08:12:00+00:00",
                Decimal("-5.45"),
                "Food & Dining",
                "Starbucks",
                "Morning coffee",
            ),
            (
                "2026-06-09T19:35:00+00:00",
                Decimal("-34.21"),
                "Transport",
                "Uber",
                "Ride to airport",
            ),
            (
                "2026-06-08T09:00:00+00:00",
                Decimal("5200.00"),
                "Income",
                "Salary",
                "Monthly salary",
            ),
            (
                "2026-06-06T12:00:00+00:00",
                Decimal("-1500.00"),
                "Housing",
                "Rent",
                "June rent",
            ),
            (
                "2026-06-05T17:20:00+00:00",
                Decimal("-87.63"),
                "Groceries",
                "Whole Foods",
                "Weekly groceries",
            ),
            (
                "2026-06-03T22:10:00+00:00",
                Decimal("-15.49"),
                "Entertainment",
                "Netflix",
                "Monthly subscription",
            ),
            (
                "2026-06-02T07:44:00+00:00",
                Decimal("-48.75"),
                "Transport",
                "Shell Gas",
                "Fuel fill up",
            ),
            (
                "2026-06-01T16:15:00+00:00",
                Decimal("-62.18"),
                "Shopping",
                "Amazon",
                "Home essentials",
            ),
        ]
        for date, amount, category, vendor, notes in samples:
            self.create(
                seed_user_id,
                TransactionCreate(
                    date=datetime.fromisoformat(date),
                    amount=amount,
                    category=category,
                    vendor=vendor,
                    notes=notes,
                ),
                event="Transaction imported",
            )

    def list_by_user(self, user_id: str) -> list[Transaction]:
        has_user_transactions = any(
            item.user_id == user_id
            for item in self._transactions
        )
        if user_id != "dev-user-1" and not has_user_transactions:
            samples = [
                item
                for item in self._transactions
                if item.user_id == "dev-user-1"
            ]
            for sample in samples:
                clone = sample.model_copy(deep=True)
                clone.id = str(uuid4())
                clone.user_id = user_id
                clone.history = [make_history_event("Transaction imported")]
                self._transactions.append(clone)
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
