from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.budget import (
    BudgetAlert,
    BudgetCategory,
    BudgetCategorySummary,
    BudgetCreate,
    BudgetHistoryResponse,
    BudgetOverview,
    BudgetRead,
    BudgetUpdate,
)
from app.services.budget_service import (
    BudgetAlreadyExistsError,
    BudgetNotFoundError,
    InvalidBudgetCategoryError,
    create_budget,
    delete_budget,
    get_budget_alerts,
    get_budget_comparison,
    get_budget_history,
    get_budget_history_detail,
    list_budget_categories,
    list_budgets,
    read_budget,
    update_budget,
)

router = APIRouter()

DUPLICATE_MESSAGE = "A budget already exists for this category and month."


@router.get("/categories", response_model=list[BudgetCategory])
def read_budget_categories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_budget_categories(db, current_user.id)


@router.get("", response_model=list[BudgetRead])
def read_budgets(
    month: int | None = Query(None, ge=1, le=12),
    year: int | None = Query(None, ge=1900, le=2200),
    category_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_budgets(
        db,
        current_user.id,
        month=month,
        year=year,
        category_id=category_id,
    )


@router.post("", response_model=BudgetRead, status_code=status.HTTP_201_CREATED)
def add_budget(
    payload: BudgetCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return create_budget(db, current_user.id, payload)
    except InvalidBudgetCategoryError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Select one of your spending categories.",
        )
    except BudgetAlreadyExistsError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=DUPLICATE_MESSAGE,
        )


@router.get("/overview", response_model=BudgetOverview)
def read_budget_overview(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=1900, le=2200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_budget_history_detail(db, current_user.id, year, month)


@router.get("/comparison", response_model=list[BudgetCategorySummary])
def read_budget_comparison(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=1900, le=2200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_budget_comparison(db, current_user.id, month, year)


@router.get("/alerts", response_model=list[BudgetAlert])
def read_budget_alerts(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=1900, le=2200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_budget_alerts(db, current_user.id, month, year)


@router.get("/history", response_model=BudgetHistoryResponse)
def read_budget_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_budget_history(db, current_user.id)


@router.get("/history/{year}/{month}", response_model=BudgetOverview)
def read_budget_history_month(
    year: int,
    month: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if month < 1 or month > 12:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Month must be between 1 and 12.",
        )
    return get_budget_history_detail(db, current_user.id, year, month)


@router.get("/{budget_id}", response_model=BudgetRead)
def read_single_budget(
    budget_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return read_budget(db, current_user.id, budget_id)
    except BudgetNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Budget not found.",
        )


@router.patch("/{budget_id}", response_model=BudgetRead)
def edit_budget(
    budget_id: int,
    payload: BudgetUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return update_budget(db, current_user.id, budget_id, payload)
    except BudgetNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Budget not found.",
        )
    except InvalidBudgetCategoryError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Select one of your spending categories.",
        )
    except BudgetAlreadyExistsError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=DUPLICATE_MESSAGE,
        )


@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_budget(
    budget_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        delete_budget(db, current_user.id, budget_id)
    except BudgetNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Budget not found.",
        )

