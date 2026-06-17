from datetime import datetime, timezone

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.services_refresh import create_refresh_token
from app.auth.utils import (
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES,
    create_access_token,
    generate_secure_token,
    get_password_hash,
    hash_security_token,
    token_expiration,
    token_is_expired,
    verify_password,
)
from app.models.financial_profile import FinancialProfile
from app.models.refresh_token import RefreshToken
from app.models.user import User as UserModel
from app.schemas.user import UserCreate


class DuplicateEmailError(Exception):
    pass


def normalize_email(email: str) -> str:
    return email.strip().lower()


def get_user_by_email(db: Session, email: str):
    return (
        db.query(UserModel)
        .filter(UserModel.email == normalize_email(email))
        .first()
    )


def issue_password_reset_token(
    db: Session,
    user: UserModel,
) -> str:
    token = generate_secure_token()
    user.password_reset_token_hash = hash_security_token(token)
    user.password_reset_expires_at = token_expiration(
        PASSWORD_RESET_TOKEN_EXPIRE_MINUTES
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return token


def create_user(db: Session, user: UserCreate):
    db_user = UserModel(
        email=normalize_email(user.email),
        hashed_password=get_password_hash(user.password),
        full_name=user.full_name,
        is_email_verified=True,
        email_verified_at=datetime.now(timezone.utc),
    )
    db.add(db_user)
    try:
        db.flush()
        db.add(FinancialProfile(user_id=db_user.id))
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise DuplicateEmailError from exc
    db.refresh(db_user)
    return db_user


def reset_user_password(db: Session, token: str, new_password: str):
    token_hash = hash_security_token(token)
    user = (
        db.query(UserModel)
        .filter(UserModel.password_reset_token_hash == token_hash)
        .first()
    )
    if not user or token_is_expired(user.password_reset_expires_at):
        return None

    user.hashed_password = get_password_hash(new_password)
    user.password_reset_token_hash = None
    user.password_reset_expires_at = None
    db.add(user)
    (
        db.query(RefreshToken)
        .filter(
            RefreshToken.user_id == user.id,
            RefreshToken.revoked.is_(False),
        )
        .update({"revoked": True}, synchronize_session=False)
    )
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str):
    user = get_user_by_email(db, email)
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user


def create_tokens_for_user(db: Session, user: UserModel):
    access_token = create_access_token({"sub": str(user.id)})
    refresh = create_refresh_token(db=db, user_id=user.id)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "refresh_token": refresh,
    }
