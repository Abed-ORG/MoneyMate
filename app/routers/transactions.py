from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.auth.utils import decode_access_token
from app.dependencies import bearer_scheme, get_db
from app.models.user import User
from app.schemas.transaction import (
    BulkRecategorizeRequest,
    Category,
    CategoryCreate,
    CategoryUpdate,
    SortDirection,
    SortField,
    Transaction,
    TransactionBulkRequest,
    TransactionCreate,
    TransactionImportRequest,
    TransactionImportResponse,
    TransactionListResponse,
    TransactionCorrectionRequest,
    TransactionSuggestionRequest,
    TransactionUpdate,
    AiCategorization,
)
from app.services.transaction_service import (
    TransactionNotFoundError,
    bulk_recategorize_transactions,
    bulk_create_transactions,
    create_category,
    create_transaction,
    correct_transaction_category,
    delete_category,
    delete_transaction,
    import_transactions,
    list_categories,
    list_transactions,
    suggest_transaction_category,
    update_category,
    update_transaction,
)

router = APIRouter()


def get_transaction_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> str:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Your session is invalid or has expired. Please log in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not credentials:
        raise credentials_error

    payload = decode_access_token(credentials.credentials)
    subject = payload.get("sub") if payload else None
    if not subject:
        raise credentials_error

    try:
        user_id = int(subject)
    except (TypeError, ValueError):
        raise credentials_error

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise credentials_error

    return str(user.id)


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


@router.get("/categories", response_model=list[Category])
def read_categories(
    user_id: str = Depends(get_transaction_user_id),
):
    return list_categories(user_id)


@router.post(
    "/categories", response_model=Category, status_code=status.HTTP_201_CREATED
)
def add_category(
    payload: CategoryCreate,
    user_id: str = Depends(get_transaction_user_id),
):
    return create_category(user_id, payload)


@router.patch("/categories/{category_id}", response_model=Category)
def edit_category(
    category_id: str,
    payload: CategoryUpdate,
    user_id: str = Depends(get_transaction_user_id),
):
    category = update_category(user_id, category_id, payload)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found.",
        )
    return category


@router.delete(
    "/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT
)
def remove_category(
    category_id: str,
    user_id: str = Depends(get_transaction_user_id),
):
    if not delete_category(user_id, category_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found.",
        )


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


@router.post("/suggest", response_model=AiCategorization)
def suggest_category(
    payload: TransactionSuggestionRequest,
    user_id: str = Depends(get_transaction_user_id),
):
    return suggest_transaction_category(
        user_id,
        payload.vendor,
        payload.notes,
        payload.amount,
    )


@router.post("/{transaction_id}/correction", response_model=Transaction)
def correct_transaction(
    transaction_id: str,
    payload: TransactionCorrectionRequest,
    user_id: str = Depends(get_transaction_user_id),
):
    try:
        return correct_transaction_category(user_id, transaction_id, payload)
    except TransactionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found.",
        )


@router.post("/bulk-recategorize", response_model=list[Transaction])
def bulk_recategorize(
    payload: BulkRecategorizeRequest,
    user_id: str = Depends(get_transaction_user_id),
):
    return bulk_recategorize_transactions(user_id, payload)
