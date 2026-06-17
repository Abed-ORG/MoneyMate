from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.services import DuplicateEmailError
from app.dependencies import get_current_user, get_db
from app.models.user import User as UserModel
from app.schemas.financial_profile import (
    FinancialProfile,
    FinancialProfilePayload,
    FinancialProfileUpdate,
)
from app.schemas.user import PasswordChange, User, UserUpdate
from app.services.profile_service import (
    InvalidCurrentPasswordError,
    change_password,
    complete_onboarding,
    get_or_create_financial_profile,
    skip_onboarding,
    update_account,
    update_financial_profile,
)

router = APIRouter()


@router.get("/me", response_model=FinancialProfile)
def read_profile(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_or_create_financial_profile(db, current_user.id)


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
