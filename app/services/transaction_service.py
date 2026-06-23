import csv
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from io import StringIO
from uuid import uuid4

from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.models.account import Account as AccountModel
from app.models.category import Category as CategoryModel
from app.models.transaction import Transaction as TransactionModel
from app.repositories.transaction_repository import (
    DEFAULT_CATEGORIES,
    transaction_repository,
)
from app.schemas.transaction import (
    AiCategorization,
    BulkRecategorizeRequest,
    Category,
    CategoryCreate,
    CategoryUpdate,
    SortDirection,
    SortField,
    Transaction,
    TransactionBulkRequest,
    TransactionCreate,
    TransactionHistoryEvent,
    TransactionImportError,
    TransactionImportRequest,
    TransactionImportResponse,
    TransactionListResponse,
    TransactionUpdate,
    TransactionCorrectionRequest,
)


class TransactionNotFoundError(Exception):
    pass


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def normalize_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def normalize_name(value: str) -> str:
    return " ".join(value.split())


def category_key(value: str) -> str:
    return normalize_name(value).casefold()


def make_history_event(event: str) -> dict[str, str]:
    return {
        "id": str(uuid4()),
        "event": event,
        "timestamp": utc_now().isoformat(),
    }


def serialize_history(
    events: list[dict] | None,
) -> list[TransactionHistoryEvent]:
    serialized: list[TransactionHistoryEvent] = []
    for event in events or []:
        try:
            serialized.append(TransactionHistoryEvent.model_validate(event))
        except ValidationError:
            continue
    return serialized


def ensure_default_account(db: Session, user_id: int) -> AccountModel:
    account = (
        db.query(AccountModel)
        .filter(AccountModel.user_id == user_id)
        .order_by(AccountModel.id.asc())
        .first()
    )
    if account:
        return account

    account = AccountModel(
        user_id=user_id,
        name="Cash",
        type="cash",
        balance=0,
        currency="USD",
    )
    db.add(account)
    db.flush()
    return account


def ensure_default_categories(
    db: Session,
    user_id: int,
) -> list[CategoryModel]:
    existing = (
        db.query(CategoryModel)
        .filter(CategoryModel.user_id == user_id)
        .all()
    )
    by_name = {category_key(category.name): category for category in existing}

    for name in DEFAULT_CATEGORIES:
        key = category_key(name)
        if key not in by_name:
            category = CategoryModel(user_id=user_id, name=name)
            db.add(category)
            db.flush()
            by_name[key] = category

    return sorted(by_name.values(), key=lambda item: item.name.lower())


def get_or_create_category(
    db: Session,
    user_id: int,
    name: str,
) -> CategoryModel:
    normalized = normalize_name(name)
    if not normalized:
        normalized = "Other"

    categories = ensure_default_categories(db, user_id)
    key = category_key(normalized)
    for category in categories:
        if category_key(category.name) == key:
            return category

    category = CategoryModel(user_id=user_id, name=normalized)
    db.add(category)
    db.flush()
    return category


def category_to_schema(category: CategoryModel) -> Category:
    return Category(
        id=str(category.id),
        user_id=str(category.user_id),
        name=category.name,
        color=category.color or "#49c5b6",
        is_default=category.name in DEFAULT_CATEGORIES,
    )


def ai_to_columns(ai: AiCategorization) -> dict[str, object]:
    return {
        "ai_category": ai.category,
        "ai_confidence": ai.confidence,
        "ai_provider": ai.provider,
        "ai_rationale": ai.rationale,
    }


def transaction_to_schema(transaction: TransactionModel) -> Transaction:
    category_name = (
        transaction.category.name if transaction.category else "Other"
    )
    vendor = transaction.vendor or transaction.description or ""
    notes = transaction.notes or ""
    ai_category = transaction.ai_category or category_name

    return Transaction(
        id=str(transaction.id),
        user_id=str(transaction.account.user_id),
        date=normalize_datetime(transaction.occurred_at or utc_now()),
        amount=transaction.amount,
        category=category_name,
        vendor=vendor,
        notes=notes,
        created_at=normalize_datetime(transaction.occurred_at or utc_now()),
        updated_at=normalize_datetime(
            transaction.updated_at or transaction.occurred_at or utc_now()
        ),
        ai_categorization=AiCategorization(
            category=ai_category,
            confidence=(
                transaction.ai_confidence
                if transaction.ai_confidence is not None
                else 0
            ),
            provider=transaction.ai_provider or "heuristic",
            rationale=transaction.ai_rationale or "",
        ),
        history=serialize_history(transaction.history),
    )


def suggest_transaction_category(
    db: Session,
    user_id: int,
    vendor: str,
    notes: str,
    amount,
):
    ensure_default_categories(db, user_id)
    return transaction_repository.suggest(str(user_id), vendor, notes, amount)


def list_transactions(
    db: Session,
    user_id: int,
    page: int,
    page_size: int,
    sort_by: SortField,
    sort_dir: SortDirection,
    search: str | None = None,
    category: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    amount_min: Decimal | None = None,
    amount_max: Decimal | None = None,
) -> TransactionListResponse:
    rows = (
        db.query(TransactionModel)
        .join(AccountModel)
        .outerjoin(CategoryModel)
        .filter(AccountModel.user_id == user_id)
        .all()
    )
    transactions = [transaction_to_schema(row) for row in rows]

    if search and search.strip():
        normalized_search = search.strip().casefold()
        transactions = [
            item
            for item in transactions
            if normalized_search in item.vendor.casefold()
            or normalized_search in item.notes.casefold()
            or normalized_search in item.category.casefold()
        ]

    if category:
        transactions = [
            item
            for item in transactions
            if item.category == category
        ]

    if date_from:
        from_date = normalize_datetime(date_from)
        transactions = [
            item
            for item in transactions
            if normalize_datetime(item.date) >= from_date
        ]

    if date_to:
        to_date = normalize_datetime(date_to)
        transactions = [
            item
            for item in transactions
            if normalize_datetime(item.date) <= to_date
        ]

    if amount_min is not None:
        transactions = [
            item
            for item in transactions
            if item.amount >= amount_min
        ]

    if amount_max is not None:
        transactions = [
            item
            for item in transactions
            if item.amount <= amount_max
        ]

    key_map = {
        "date": lambda item: item.date,
        "amount": lambda item: item.amount,
        "category": lambda item: item.category.lower(),
    }
    transactions.sort(key=key_map[sort_by], reverse=sort_dir == "desc")

    total = len(transactions)
    start = max(page - 1, 0) * page_size
    end = start + page_size
    return TransactionListResponse(
        items=transactions[start:end],
        total=total,
        page=page,
        page_size=page_size,
    )


def create_transaction(
    db: Session,
    user_id: int,
    payload: TransactionCreate,
    event: str = "Transaction created",
) -> Transaction:
    account = ensure_default_account(db, user_id)
    category = get_or_create_category(db, user_id, payload.category)
    ai = suggest_transaction_category(
        db,
        user_id,
        payload.vendor,
        payload.notes,
        payload.amount,
    )
    transaction = TransactionModel(
        account_id=account.id,
        category_id=category.id,
        amount=payload.amount,
        description=payload.vendor,
        vendor=payload.vendor,
        notes=payload.notes,
        occurred_at=normalize_datetime(payload.date),
        type="income" if payload.amount > 0 else "expense",
        history=[make_history_event(event)],
        **ai_to_columns(ai),
    )
    db.add(transaction)
    transaction_repository.record_correction(str(user_id), payload.category)
    db.commit()
    db.refresh(transaction)
    return transaction_to_schema(transaction)


def get_transaction(
    db: Session,
    user_id: int,
    transaction_id: str,
) -> TransactionModel:
    try:
        numeric_id = int(transaction_id)
    except ValueError:
        raise TransactionNotFoundError

    transaction = (
        db.query(TransactionModel)
        .join(AccountModel)
        .filter(
            TransactionModel.id == numeric_id,
            AccountModel.user_id == user_id,
        )
        .first()
    )
    if not transaction:
        raise TransactionNotFoundError
    return transaction


def update_transaction(
    db: Session,
    user_id: int,
    transaction_id: str,
    payload: TransactionUpdate,
) -> Transaction:
    transaction = get_transaction(db, user_id, transaction_id)
    current = transaction_to_schema(transaction)
    values = payload.model_dump(exclude_unset=True)

    next_category_name = values.get("category", current.category)
    next_vendor = values.get("vendor", current.vendor) or ""
    next_notes = values.get("notes", current.notes) or ""
    next_amount = values.get("amount", current.amount)
    next_date = values.get("date", current.date)

    category = get_or_create_category(db, user_id, next_category_name)
    ai = suggest_transaction_category(
        db,
        user_id,
        next_vendor,
        next_notes,
        next_amount,
    )
    history = [
        *(transaction.history or []),
        make_history_event("Transaction modified"),
    ]
    if next_notes != current.notes and next_notes:
        history.append(make_history_event(f'Added note "{next_notes}"'))

    transaction.category_id = category.id
    transaction.amount = next_amount
    transaction.description = next_vendor
    transaction.vendor = next_vendor
    transaction.notes = next_notes
    transaction.occurred_at = normalize_datetime(next_date)
    transaction.type = "income" if next_amount > 0 else "expense"
    transaction.history = history
    for key, value in ai_to_columns(ai).items():
        setattr(transaction, key, value)

    if "category" in values and values["category"]:
        transaction_repository.record_correction(
            str(user_id),
            str(values["category"]),
        )

    db.commit()
    db.refresh(transaction)
    return transaction_to_schema(transaction)


def delete_transaction(db: Session, user_id: int, transaction_id: str) -> None:
    transaction = get_transaction(db, user_id, transaction_id)
    db.delete(transaction)
    db.commit()


def list_categories(db: Session, user_id: int) -> list[Category]:
    categories = ensure_default_categories(db, user_id)
    db.commit()
    return [category_to_schema(category) for category in categories]


def create_category(
    db: Session,
    user_id: int,
    payload: CategoryCreate,
) -> Category:
    category = get_or_create_category(db, user_id, payload.name)
    category.color = payload.color
    db.commit()
    db.refresh(category)
    return category_to_schema(category)


def update_category(
    db: Session,
    user_id: int,
    category_id: str,
    payload: CategoryUpdate,
) -> Category | None:
    try:
        numeric_id = int(category_id)
    except ValueError:
        return None

    category = (
        db.query(CategoryModel)
        .filter(
            CategoryModel.id == numeric_id,
            CategoryModel.user_id == user_id,
        )
        .first()
    )
    if not category:
        return None

    values = payload.model_dump(exclude_unset=True)
    if "name" in values and values["name"]:
        category.name = values["name"]
    if "color" in values and values["color"]:
        category.color = values["color"]
    db.commit()
    db.refresh(category)
    return category_to_schema(category)


def delete_category(db: Session, user_id: int, category_id: str) -> bool:
    try:
        numeric_id = int(category_id)
    except ValueError:
        return False

    category = (
        db.query(CategoryModel)
        .filter(
            CategoryModel.id == numeric_id,
            CategoryModel.user_id == user_id,
        )
        .first()
    )
    if not category or category.name in DEFAULT_CATEGORIES:
        return False
    db.delete(category)
    db.commit()
    return True


def correct_transaction_category(
    db: Session,
    user_id: int,
    transaction_id: str,
    payload: TransactionCorrectionRequest,
) -> Transaction:
    transaction = get_transaction(db, user_id, transaction_id)
    category = get_or_create_category(db, user_id, payload.category)
    transaction.category_id = category.id
    transaction.ai_category = payload.category
    transaction.ai_confidence = 100
    transaction.ai_provider = "user"
    transaction.ai_rationale = "User correction applied."
    transaction.history = [
        *(transaction.history or []),
        make_history_event(f"Corrected category to {payload.category}"),
    ]
    transaction_repository.record_correction(str(user_id), payload.category)
    db.commit()
    db.refresh(transaction)
    return transaction_to_schema(transaction)


def bulk_recategorize_transactions(
    db: Session,
    user_id: int,
    payload: BulkRecategorizeRequest,
) -> list[Transaction]:
    rows = (
        db.query(TransactionModel)
        .join(AccountModel)
        .filter(AccountModel.user_id == user_id)
        .all()
    )
    if payload.transaction_ids:
        wanted_ids = {
            int(item)
            for item in payload.transaction_ids
            if item.isdigit()
        }
        rows = [row for row in rows if row.id in wanted_ids]

    for transaction in rows:
        current = transaction_to_schema(transaction)
        ai = suggest_transaction_category(
            db,
            user_id,
            current.vendor,
            current.notes,
            current.amount,
        )
        category = get_or_create_category(db, user_id, ai.category)
        transaction.category_id = category.id
        transaction.category = category
        transaction.history = [
            *(transaction.history or []),
            make_history_event(
                f"Transaction recategorized with AI to {ai.category}"
            ),
        ]
        for key, value in ai_to_columns(ai).items():
            setattr(transaction, key, value)

    db.commit()
    return [
        transaction_to_schema(transaction)
        for transaction in rows
    ]


def bulk_create_transactions(
    db: Session,
    user_id: int,
    payload: TransactionBulkRequest,
) -> TransactionImportResponse:
    created = [
        create_transaction(
            db,
            user_id,
            transaction,
            event="Transaction imported",
        )
        for transaction in payload.transactions
    ]
    return TransactionImportResponse(
        imported=len(created),
        failed=0,
        errors=[],
        transactions=created,
    )


def import_transactions(
    db: Session,
    user_id: int,
    payload: TransactionImportRequest,
) -> TransactionImportResponse:
    try:
        rows = list(csv.DictReader(StringIO(payload.csv_content)))
    except csv.Error as exc:
        msg = f"Malformed CSV: {exc}"
        return TransactionImportResponse(
            imported=0,
            failed=1,
            errors=[TransactionImportError(row=0, message=msg)],
            transactions=[],
        )

    created: list[Transaction] = []
    errors: list[TransactionImportError] = []
    mapping = payload.mapping

    for index, row in enumerate(rows, start=2):
        if not any((value or "").strip() for value in row.values()):
            continue
        try:
            date_str = row.get(mapping.get("date", ""), "")
            amount_str = row.get(mapping.get("amount", ""), "")
            category = row.get(mapping.get("category", ""), "")
            vendor = row.get(mapping.get("vendor", ""), "")
            notes = row.get(mapping.get("notes", ""), "")

            transaction = TransactionCreate(
                date=datetime.fromisoformat(date_str),
                amount=Decimal(amount_str),
                category=category,
                vendor=vendor,
                notes=notes,
            )

            created.append(
                create_transaction(
                    db,
                    user_id,
                    transaction,
                    event="Transaction imported",
                )
            )
        except (ValueError, InvalidOperation, ValidationError) as exc:
            errors.append(TransactionImportError(row=index, message=str(exc)))

    return TransactionImportResponse(
        imported=len(created),
        failed=len(errors),
        errors=errors,
        transactions=created,
    )
