"""add_start_date_to_goals

Revision ID: d3e5f7a9b1c2
Revises: c6e3f9a2b8d1
Create Date: 2026-06-26 13:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d3e5f7a9b1c2"
down_revision: Union[str, None] = "c6e3f9a2b8d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    columns = {
        column["name"] for column in sa.inspect(bind).get_columns("goals")
    }
    if "start_date" not in columns:
        op.add_column(
            "goals",
            sa.Column("start_date", sa.DateTime(), nullable=True),
        )


def downgrade() -> None:
    op.drop_column("goals", "start_date")
