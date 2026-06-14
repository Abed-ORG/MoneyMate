from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.auth.utils import decode_access_token
from app.dependencies import bearer_scheme, get_db
from app.models.user import User
from app.schemas.transaction import (
    SortDirection,
    SortField,
    Transaction,
    TransactionBulkRequest,
    TransactionCreate,
    TransactionImportRequest,
    TransactionImportResponse,
    TransactionListResponse,
    TransactionUpdate,
)
from app.services.transaction_service import (
    TransactionNotFoundError,
    bulk_create_transactions,
    create_transaction,
    delete_transaction,
    import_transactions,
    list_transactions,
    update_transaction,
)

router = APIRouter()


def get_transaction_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> str:
    if not credentials:
        return "dev-user-1"

    payload = decode_access_token(credentials.credentials)
    subject = payload.get("sub") if payload else None
    if not subject:
        return "dev-user-1"

    try:
        user_id = int(subject)
    except (TypeError, ValueError):
        return "dev-user-1"

    try:
        user = db.query(User).filter(User.id == user_id).first()
    except Exception:
        return "dev-user-1"

    return str(user.id) if user else "dev-user-1"


@router.get("", response_model=TransactionListResponse)
def read_transactions(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    sort_by: SortField = "date",
    sort_dir: SortDirection = "desc",
    search: str | None = Query(None, max_length=120),
    category: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    amount_min: Decimal | None = None,
    amount_max: Decimal | None = None,
    user_id: str = Depends(get_transaction_user_id),
):
    return list_transactions(
        user_id=user_id,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_dir=sort_dir,
        search=search,
        category=category,
        date_from=date_from,
        date_to=date_to,
        amount_min=amount_min,
        amount_max=amount_max,
    )


@router.post(
    "",
    response_model=Transaction,
    status_code=status.HTTP_201_CREATED,
)
def add_transaction(
    payload: TransactionCreate,
    user_id: str = Depends(get_transaction_user_id),
):
    return create_transaction(user_id, payload)


@router.patch("/{transaction_id}", response_model=Transaction)
def edit_transaction(
    transaction_id: str,
    payload: TransactionUpdate,
    user_id: str = Depends(get_transaction_user_id),
):
    try:
        return update_transaction(user_id, transaction_id, payload)
    except TransactionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found.",
        )


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_transaction(
    transaction_id: str,
    user_id: str = Depends(get_transaction_user_id),
):
    try:
        delete_transaction(user_id, transaction_id)
    except TransactionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found.",
        )


@router.post("/bulk", response_model=TransactionImportResponse)
def bulk_import_transactions(
    payload: TransactionBulkRequest,
    user_id: str = Depends(get_transaction_user_id),
):
    return bulk_create_transactions(user_id, payload)


@router.post("/import", response_model=TransactionImportResponse)
def upload_csv_transactions(
    payload: TransactionImportRequest,
    user_id: str = Depends(get_transaction_user_id),
):
    return import_transactions(user_id, payload)
