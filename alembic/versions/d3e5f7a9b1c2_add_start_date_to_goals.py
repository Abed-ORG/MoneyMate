"""add_start_date_to_goals

Revision ID: d3e5f7a9b1c2
Revises: a1b2c3d4e5f6
Create Date: 2026-06-26 13:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d3e5f7a9b1c2"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "goals",
        sa.Column("start_date", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("goals", "start_date")
