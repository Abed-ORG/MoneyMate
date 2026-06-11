import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.refresh_token import RefreshToken
from app.models.user import User

REFRESH_TOKEN_EXPIRE_DAYS = 30


def create_refresh_token(db: Session, user_id: int) -> str:
    token = secrets.token_urlsafe(48)
    db_token = RefreshToken(token=token, user_id=user_id)
    db.add(db_token)
    db.commit()
    db.refresh(db_token)
    return db_token.token


def revoke_refresh_token(db: Session, token: str):
    db_token = (
        db.query(RefreshToken)
        .filter(RefreshToken.token == token)
        .first()
    )
    if db_token:
        db_token.revoked = True
        db.add(db_token)
        db.commit()
    return db_token


def get_user_for_refresh_token(db: Session, token: str):
    db_token = (
        db.query(RefreshToken)
        .filter(RefreshToken.token == token, RefreshToken.revoked.is_(False))
        .first()
    )
    if not db_token or not db_token.created_at:
        return None

    created_at = db_token.created_at
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    if (
        created_at + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
        <= datetime.now(timezone.utc)
    ):
        revoke_refresh_token(db, token)
        return None

    return db.query(User).filter(User.id == db_token.user_id).first()


def is_refresh_token_valid(db: Session, token: str) -> bool:
    db_token = (
        db.query(RefreshToken)
        .filter(
            RefreshToken.token == token,
            RefreshToken.revoked.is_(False),
        )
        .first()
    )
    return db_token is not None
