# flake8: noqa
from sqlalchemy.orm import Session
from app.models.user import User as UserModel
from app.schemas.user import UserCreate
from app.auth.utils import get_password_hash, verify_password, create_access_token
from app.auth.services_refresh import create_refresh_token


def get_user_by_email(db: Session, email: str):
    return db.query(UserModel).filter(UserModel.email == email).first()


def create_user(db: Session, user: UserCreate):
    hashed = get_password_hash(user.password)
    db_user = UserModel(email=user.email, hashed_password=hashed, full_name=user.full_name)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def authenticate_user(db: Session, email: str, password: str):
    user = get_user_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def create_tokens_for_user(db, user):
    access_token = create_access_token({"sub": str(user.id)})
    # create and return a refresh token using provided db session
    refresh = create_refresh_token(db=db, user_id=user.id)
    return {"access_token": access_token, "token_type": "bearer", "refresh_token": refresh}
