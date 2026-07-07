# flake8: noqa
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./test.db").strip()
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL environment variable must be set before "
        "MoneyMate starts."
    )

# Detect sqlite to set connect args
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    engine = create_engine(DATABASE_URL, connect_args=connect_args)
else:
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=300,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def init_db():
    """Create database tables."""
    # Alembic manages schema migrations; avoid create_all to prevent drift.
    # If you need to create tables for quick local testing, run:
    # Base.metadata.create_all(bind=engine)
    return
