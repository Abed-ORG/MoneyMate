from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.services import DuplicateEmailError
from app.dependencies import get_current_user, get_db
from app.models.user import User as UserModel
from app.schemas.financial_profile import (
    FinancialProfile,
    FinancialProfilePayload,
    FinancialProfileUpdate,
    MonthlyIncomeHistoryResponse,
)
from app.schemas.user import PasswordChange, User, UserUpdate
from app.services.profile_service import (
    InvalidCurrentPasswordError,
    change_password,
    complete_onboarding,
    delete_account,
    get_or_create_financial_profile,
    skip_onboarding,
    update_account,
    update_financial_profile,
)
from app.services.income_service import income_by_month_key

router = APIRouter()


@router.get("/me", response_model=FinancialProfile)
def read_profile(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_or_create_financial_profile(db, current_user.id)


@router.get(
    "/monthly-income-history",
    response_model=MonthlyIncomeHistoryResponse,
)
def read_monthly_income_history(
    date_from: date = Query(...),
    date_to: date = Query(...),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if date_from > date_to:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="date_from must be before or equal to date_to.",
        )
    return MonthlyIncomeHistoryResponse(
        monthly_income_by_month=income_by_month_key(
            db,
            current_user.id,
            date_from,
            date_to,
        ),
    )


@router.post("/onboarding", response_model=FinancialProfile)
def save_onboarding(
    payload: FinancialProfilePayload,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return complete_onboarding(db, current_user.id, payload)


@router.post("/onboarding/skip", response_model=FinancialProfile)
def skip_profile_onboarding(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return skip_onboarding(db, current_user.id)


@router.put("/me", response_model=FinancialProfile)
def edit_financial_profile(
    payload: FinancialProfileUpdate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return update_financial_profile(db, current_user.id, payload)


@router.put("/account", response_model=User)
def edit_account(
    payload: UserUpdate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return update_account(
            db,
            current_user,
            payload,
        )
    except DuplicateEmailError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )


@router.put("/password", status_code=status.HTTP_204_NO_CONTENT)
def edit_password(
    payload: PasswordChange,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        change_password(db, current_user, payload)
    except InvalidCurrentPasswordError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Your current password is incorrect."
            ),
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


@router.delete("/account", status_code=status.HTTP_204_NO_CONTENT)
def remove_account(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    delete_account(db, current_user)
