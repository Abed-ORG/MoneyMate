import csv
from datetime import datetime
from decimal import Decimal, InvalidOperation
from io import StringIO

from pydantic import ValidationError

from app.repositories.transaction_repository import transaction_repository
from app.schemas.transaction import (
    SortDirection,
    SortField,
    Transaction,
    TransactionBulkRequest,
    TransactionCreate,
    TransactionImportError,
    TransactionImportRequest,
    TransactionImportResponse,
    TransactionListResponse,
    TransactionUpdate,
)


class TransactionNotFoundError(Exception):
    pass


def list_transactions(
    user_id: str,
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
    transactions = transaction_repository.list_by_user(user_id)
    if search and search.strip():
        normalized_search = search.strip().casefold()
        transactions = [
            item
            for item in transactions
            if normalized_search in item.vendor.casefold()
        ]
   if category:
    transactions = [
        item
        for item in transactions
        if item.category == category
    ]
if date_from:
    transactions = [
        item
        for item in transactions
        if item.date >= date_from
    ]
if date_to:
    transactions = [item for item in transactions if item.date <= date_to]
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
    user_id: str, payload: TransactionCreate
) -> Transaction:
    return transaction_repository.create(user_id, payload)


def update_transaction(
    user_id: str, transaction_id: str, payload: TransactionUpdate
) -> Transaction:
    transaction = transaction_repository.update(
        user_id,
        transaction_id,
        payload,
    )
    if not transaction:
        raise TransactionNotFoundError
    return transaction


def delete_transaction(user_id: str, transaction_id: str) -> None:
    if not transaction_repository.delete(user_id, transaction_id):
        raise TransactionNotFoundError


def bulk_create_transactions(
    user_id: str, payload: TransactionBulkRequest
) -> TransactionImportResponse:
    created = [
        transaction_repository.create(
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
    user_id: str,
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
                transaction_repository.create(
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
