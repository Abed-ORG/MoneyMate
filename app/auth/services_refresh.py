import uuid
from sqlalchemy.orm import Session
from app.models.refresh_token import RefreshToken


def create_refresh_token(db: Session, user_id: int) -> str:
    token = str(uuid.uuid4())
    db_token = RefreshToken(token=token, user_id=user_id)
    db.add(db_token)
    db.commit()
    db.refresh(db_token)
    return db_token.token


def revoke_refresh_token(db: Session, token: str):
    db_token = db.query(RefreshToken).filter(RefreshToken.token == token).first()
    if db_token:
        db_token.revoked = True
        db.add(db_token)
        db.commit()
    return db_token


def is_refresh_token_valid(db: Session, token: str) -> bool:
    db_token = db.query(RefreshToken).filter(
        RefreshToken.token == token, RefreshToken.revoked.is_(False)
    ).first()
    return db_token is not None
