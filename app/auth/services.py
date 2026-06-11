from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.services_refresh import create_refresh_token
from app.auth.utils import (
    create_access_token,
    decode_email_verification_token,
    get_password_hash,
    verify_password,
)
from app.models.financial_profile import FinancialProfile
from app.models.user import User as UserModel
from app.schemas.user import UserCreate


class DuplicateEmailError(Exception):
    pass


def normalize_email(email: str) -> str:
    return email.strip().lower()


def get_user_by_email(db: Session, email: str):
    return db.query(UserModel).filter(UserModel.email == normalize_email(email)).first()


def create_user(db: Session, user: UserCreate, verification_sender=None):
    db_user = UserModel(
        email=normalize_email(user.email),
        hashed_password=get_password_hash(user.password),
        full_name=user.full_name,
    )
    db.add(db_user)
    try:
        db.flush()
        db.add(FinancialProfile(user_id=db_user.id))
        if verification_sender:
            verification_sender(db_user)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise DuplicateEmailError from exc
    db.refresh(db_user)
    return db_user


def verify_user_email(db: Session, token: str):
    payload = decode_email_verification_token(token)
    if not payload:
        return None
    try:
        user_id = int(payload.get("sub"))
    except (TypeError, ValueError):
        return None

    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user or user.email != payload.get("email"):
        return None
    if not user.is_email_verified:
        from datetime import datetime, timezone

        user.is_email_verified = True
        user.email_verified_at = datetime.now(timezone.utc)
        db.add(user)
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
