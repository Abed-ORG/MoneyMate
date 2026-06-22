from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_transactions(
        db=db,
        user_id=current_user.id,
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return create_transaction(db, current_user.id, payload)


@router.get("/categories", response_model=list[Category])
def read_categories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_categories(db, current_user.id)


@router.post(
    "/categories", response_model=Category, status_code=status.HTTP_201_CREATED
)
def add_category(
    payload: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return create_category(db, current_user.id, payload)


@router.patch("/categories/{category_id}", response_model=Category)
def edit_category(
    category_id: str,
    payload: CategoryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    category = update_category(db, current_user.id, category_id, payload)
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not delete_category(db, current_user.id, category_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found.",
        )


@router.patch("/{transaction_id}", response_model=Transaction)
def edit_transaction(
    transaction_id: str,
    payload: TransactionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return update_transaction(db, current_user.id, transaction_id, payload)
    except TransactionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found.",
        )


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_transaction(
    transaction_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        delete_transaction(db, current_user.id, transaction_id)
    except TransactionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found.",
        )


@router.post("/bulk", response_model=TransactionImportResponse)
def bulk_import_transactions(
    payload: TransactionBulkRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return bulk_create_transactions(db, current_user.id, payload)


@router.post("/import", response_model=TransactionImportResponse)
def upload_csv_transactions(
    payload: TransactionImportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return import_transactions(db, current_user.id, payload)


@router.post("/suggest", response_model=AiCategorization)
def suggest_category(
    payload: TransactionSuggestionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return suggest_transaction_category(
        db,
        current_user.id,
        payload.vendor,
        payload.notes,
        payload.amount,
    )


@router.post("/{transaction_id}/correction", response_model=Transaction)
def correct_transaction(
    transaction_id: str,
    payload: TransactionCorrectionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return correct_transaction_category(
            db,
            current_user.id,
            transaction_id,
            payload,
        )
    except TransactionNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found.",
        )


@router.post("/bulk-recategorize", response_model=list[Transaction])
def bulk_recategorize(
    payload: BulkRecategorizeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return bulk_recategorize_transactions(db, current_user.id, payload)
