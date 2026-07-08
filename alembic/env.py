# flake8: noqa
from logging.config import fileConfig
import os
from pathlib import Path
import sys

from dotenv import load_dotenv
from sqlalchemy import engine_from_config
from sqlalchemy import pool
from alembic import context

config = context.config

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

fileConfig(config.config_file_name)

# load .env so alembic picks up DATABASE_URL when run from shell
load_dotenv()

from app.db import Base
from app.models import (
    user,
    account,
    transaction,
    category,
    budget,
    goal,
    chat_history,
    financial_profile,
    income_history,
    item,
    refresh_token,
)  # noqa: F401

target_metadata = Base.metadata


def run_migrations_offline():
    url = os.getenv('DATABASE_URL')
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    configuration = config.get_section(config.config_ini_section)
    configuration['sqlalchemy.url'] = os.getenv('DATABASE_URL')
    connectable = engine_from_config(
        configuration,
        prefix='sqlalchemy.',
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
