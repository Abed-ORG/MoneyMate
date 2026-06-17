import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth.services import (
    DuplicateEmailError,
    authenticate_user,
    create_tokens_for_user,
    create_user,
    get_user_by_email,
    issue_email_verification_token,
    issue_password_reset_token,
    reset_user_password,
    verify_user_email,
)
from app.auth.services_refresh import (
    get_user_for_refresh_token,
    revoke_refresh_token,
)
from app.dependencies import get_db
from app.models.user import User as UserModel
from app.schemas.user import (
    EmailVerificationRequest,
    ForgotPasswordRequest,
    LoginRequest,
    LogoutRequest,
    MessageResponse,
    RefreshRequest,
    ResetPasswordRequest,
    TokenResponse,
    User,
    UserCreate,
    VerificationEmailRequest,
)
from app.services.email_service import (
    EmailConfigurationError,
    EmailDeliveryError,
    send_password_reset_email,
    send_verification_email,
)

router = APIRouter()
bearer_scheme = HTTPBearer(auto_error=False)
logger = logging.getLogger(__name__)


def _get_current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
):
    """Lazy import of get_current_user to break circular import.

    dependencies.py -> auth/utils.py -> auth/__init__.py ->
    auth/routes.py -> dependencies.py
    """
    from app.dependencies import get_current_user as _get_current_user

    return _get_current_user(credentials, db)


@router.post(
    "/register",
    response_model=User,
    status_code=status.HTTP_201_CREATED,
)
def register(user: UserCreate, db: Session = Depends(get_db)):
    if get_user_by_email(db, user.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )
    try:
        db_user, verification_token = create_user(db, user)
    except DuplicateEmailError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )
    try:
        send_verification_email(db_user, verification_token)
    except (EmailConfigurationError, EmailDeliveryError) as exc:
        logger.exception("Email delivery failed during registration for %s", user.email)
        raise HTTPException(
            status_code=status.HTTP_424_FAILED_DEPENDENCY,
            detail=(
                "Your account was created, but the verification email could "
                "not be sent. Go to login and use Resend verification email."
            ),
        )
    return db_user


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


def _verify_email_token(token: str, db: Session):
    user = verify_user_email(db, token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This verification link is invalid or has expired.",
        )
    return {
        "message": "Your email has been verified. You can now log in."
    }


@router.get("/verify-email", response_model=MessageResponse)
def verify_email_link(token: str, db: Session = Depends(get_db)):
    return _verify_email_token(token, db)


@router.post("/verify-email", response_model=MessageResponse)
def verify_email(
    payload: EmailVerificationRequest,
    db: Session = Depends(get_db),
):
    return _verify_email_token(payload.token, db)


@router.post("/resend-verification", response_model=MessageResponse)
def resend_verification(
    payload: VerificationEmailRequest,
    db: Session = Depends(get_db),
):
    user = get_user_by_email(db, payload.email)
    if user and not user.is_email_verified:
        try:
            token = issue_email_verification_token(db, user)
            send_verification_email(user, token)
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


@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(
    payload: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    user = get_user_by_email(db, payload.email)
    if user:
        try:
            token = issue_password_reset_token(db, user)
            send_password_reset_email(user, token)
        except (EmailConfigurationError, EmailDeliveryError):
            logger.exception(
                "Password reset email delivery failed for user id %s.",
                user.id,
            )
    return {
        "message": (
            "If an account with this email exists, a reset link has been sent."
        )
    }


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    user = reset_user_password(db, payload.token, payload.new_password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This password reset link is invalid or has expired.",
        )
    return {
        "message": (
            "Your password has been reset. You can now log in with your new "
            "password."
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
