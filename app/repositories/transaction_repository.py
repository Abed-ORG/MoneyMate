from copy import deepcopy
from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

from app.services.gemini_service import GeminiRequest, suggest_category
from app.schemas.transaction import (
    AiCategorization,
    BulkRecategorizeRequest,
    Category,
    CategoryCreate,
    CategoryUpdate,
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


DEFAULT_CATEGORIES = [
    "Food & Dining",
    "Transport",
    "Housing",
    "Groceries",
    "Entertainment",
    "Shopping",
    "Healthcare",
    "Utilities",
    "Education",
    "Travel",
    "Personal Care",
    "Other",
    "Income",
]


def make_history_event(event: str) -> TransactionHistoryEvent:
    return TransactionHistoryEvent(
        id=str(uuid4()),
        event=event,
        timestamp=utc_now(),
    )


class InMemoryTransactionRepository:
    def __init__(self) -> None:
        self._transactions: list[Transaction] = []
        self._categories: dict[str, list[Category]] = {}
        self._corrections: dict[str, list[str]] = {}
        self._seed()

    def _ensure_user_state(self, user_id: str) -> None:
        self._categories.setdefault(
            user_id,
            [
                Category(
                    id=str(uuid4()),
                    user_id=user_id,
                    name=name,
                    color="#69f56a",
                    is_default=True,
                )
                for name in DEFAULT_CATEGORIES
            ],
        )
        self._corrections.setdefault(user_id, [])

    def list_categories(self, user_id: str) -> list[Category]:
        self._ensure_user_state(user_id)
        return [deepcopy(item) for item in self._categories[user_id]]

    def create_category(self, user_id: str, payload: CategoryCreate) -> Category:
        self._ensure_user_state(user_id)
        category = Category(
            id=str(uuid4()),
            user_id=user_id,
            name=payload.name,
            color=payload.color,
            is_default=payload.is_default,
        )
        self._categories[user_id].append(category)
        return deepcopy(category)

    def update_category(
        self, user_id: str, category_id: str, payload: CategoryUpdate
    ) -> Category | None:
        self._ensure_user_state(user_id)
        for index, category in enumerate(self._categories[user_id]):
            if category.id != category_id:
                continue
            updated = category.model_copy(
                update=payload.model_dump(exclude_unset=True),
            )
            self._categories[user_id][index] = updated
            return deepcopy(updated)
        return None

    def delete_category(self, user_id: str, category_id: str) -> bool:
        self._ensure_user_state(user_id)
        for index, category in enumerate(self._categories[user_id]):
            if category.id == category_id and not category.is_default:
                del self._categories[user_id][index]
                return True
        return False

    def record_correction(self, user_id: str, category: str) -> None:
        self._ensure_user_state(user_id)
        normalized = " ".join(category.split())
        if normalized not in self._corrections[user_id]:
            self._corrections[user_id].insert(0, normalized)

    def get_corrections(self, user_id: str) -> list[str]:
        self._ensure_user_state(user_id)
        return list(self._corrections[user_id][:10])

    def _ai_category(self, user_id: str, category: str, vendor: str, notes: str, amount: Decimal) -> AiCategorization:
        categories = self.list_categories(user_id)
        request_data = GeminiRequest(
            vendor=vendor,
            notes=notes,
            amount=str(amount),
            category_names=[item.name for item in categories],
            correction_history=self.get_corrections(user_id),
        )
        suggestion = suggest_category(request_data)
        if category and category in request_data.category_names:
            return AiCategorization(
                category=category,
                confidence=100,
                provider="manual",
                rationale="User-selected category.",
            )
        return suggestion

    def _seed(self) -> None:
        if self._transactions:
            return
        seed_user_id = "dev-user-1"
        self._ensure_user_state(seed_user_id)
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
            ai_categorization=self._ai_category(
                user_id,
                payload.category,
                payload.vendor,
                payload.notes,
                payload.amount,
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
            updated.ai_categorization = self._ai_category(
                user_id,
                updated.category,
                updated.vendor,
                updated.notes,
                updated.amount,
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

    def recategorize(
        self,
        user_id: str,
        transaction_ids: list[str],
    ) -> list[Transaction]:
        self._ensure_user_state(user_id)
        updated_items: list[Transaction] = []
        for index, transaction in enumerate(self._transactions):
            if transaction.user_id != user_id:
                continue
            if transaction_ids and transaction.id not in transaction_ids:
                continue
            recategorized = transaction.model_copy()
            recategorized.ai_categorization = self._ai_category(
                user_id,
                recategorized.category,
                recategorized.vendor,
                recategorized.notes,
                recategorized.amount,
            )
            recategorized.history = [
                *transaction.history,
                make_history_event("Transaction recategorized with AI"),
            ]
            self._transactions[index] = recategorized
            updated_items.append(deepcopy(recategorized))
        return updated_items

    def correct_category(
        self,
        user_id: str,
        transaction_id: str,
        category: str,
    ) -> Transaction | None:
        self._ensure_user_state(user_id)
        for index, transaction in enumerate(self._transactions):
            if transaction.id != transaction_id or transaction.user_id != user_id:
                continue
            updated = transaction.model_copy(update={"category": category})
            updated.ai_categorization = AiCategorization(
                category=category,
                confidence=100,
                provider="user",
                rationale="User correction applied.",
            )
            updated.history = [
                *transaction.history,
                make_history_event(f"Corrected category to {category}"),
            ]
            self.record_correction(user_id, category)
            self._transactions[index] = updated
            return deepcopy(updated)
        return None

    def custom_categories(self, user_id: str) -> list[Category]:
        return self.list_categories(user_id)

    def suggest(self, user_id: str, category: str, vendor: str, notes: str, amount: Decimal) -> AiCategorization:
        self._ensure_user_state(user_id)
        return self._ai_category(user_id, category, vendor, notes, amount)


transaction_repository = InMemoryTransactionRepository()
