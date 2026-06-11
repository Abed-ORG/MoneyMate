# flake8: noqa
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth.services import (
    DuplicateEmailError,
    authenticate_user,
    create_tokens_for_user,
    create_user,
    get_user_by_email,
    verify_user_email,
)
from app.auth.services_refresh import (
    get_user_for_refresh_token,
    revoke_refresh_token,
)
from app.dependencies import get_db
from app.models.user import User as UserModel
from app.schemas.user import (
    LoginRequest,
    EmailVerificationRequest,
    LogoutRequest,
    MessageResponse,
    RefreshRequest,
    TokenResponse,
    User,
    UserCreate,
    VerificationEmailRequest,
)
from app.services.email_service import (
    EmailConfigurationError,
    EmailDeliveryError,
    send_verification_email,
)

router = APIRouter()
bearer_scheme = HTTPBearer(auto_error=False)


def _get_current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
):
    """Lazy import of get_current_user to break circular import:
    dependencies.py -> auth/utils.py -> auth/__init__.py -> auth/routes.py -> dependencies.py
    """
    from app.dependencies import get_current_user as _get_current_user

    return _get_current_user(credentials, db)


@router.post("/register", response_model=User, status_code=status.HTTP_201_CREATED)
def register(user: UserCreate, db: Session = Depends(get_db)):
    if get_user_by_email(db, user.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )
    try:
        return create_user(db, user, send_verification_email)
    except DuplicateEmailError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )
    except EmailConfigurationError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )
    except EmailDeliveryError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )


@router.post("/login", response_model=TokenResponse)
def login(form_data: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, form_data.email, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="The email or password you entered is incorrect.",
        )
    if not user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Verify your email address before logging in.",
        )
    return create_tokens_for_user(db, user)


@router.post("/verify-email", response_model=MessageResponse)
def verify_email(payload: EmailVerificationRequest, db: Session = Depends(get_db)):
    user = verify_user_email(db, payload.token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This verification link is invalid or has expired.",
        )
    return {"message": "Your email address has been verified."}


@router.post("/resend-verification", response_model=MessageResponse)
def resend_verification(
    payload: VerificationEmailRequest,
    db: Session = Depends(get_db),
):
    user = get_user_by_email(db, payload.email)
    if user and not user.is_email_verified:
        try:
            send_verification_email(user)
        except (EmailConfigurationError, EmailDeliveryError) as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=str(exc),
            )
    return {
        "message": (
            "If an unverified account exists for that email, "
            "a new verification link has been sent."
        )
    }


@router.post("/refresh", response_model=TokenResponse)
def refresh_tokens(payload: RefreshRequest, db: Session = Depends(get_db)):
    user = get_user_for_refresh_token(db, payload.refresh_token)
    if not user or not user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your session has expired. Please log in again.",
        )
    revoke_refresh_token(db, payload.refresh_token)
    return create_tokens_for_user(db, user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(payload: LogoutRequest, db: Session = Depends(get_db)):
    if payload.refresh_token:
        revoke_refresh_token(db, payload.refresh_token)


@router.get("/me", response_model=User)
def read_current_user(
    current_user: UserModel = Depends(_get_current_user_dep),
):
    return current_user