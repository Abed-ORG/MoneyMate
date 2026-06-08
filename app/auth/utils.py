from passlib.context import CryptContext
from datetime import datetime, timedelta
from jose import jwt
import os

# Use Argon2 via passlib to avoid bcrypt binary issues on Windows
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY environment variable must be set")
ALGORITHM = "HS256"


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: int = 60 * 24):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=expires_delta)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
