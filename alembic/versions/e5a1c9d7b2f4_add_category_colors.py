"""Add category colors.

Revision ID: e5a1c9d7b2f4
Revises: d2f6a8c4b9e0
Create Date: 2026-06-22 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "e5a1c9d7b2f4"
down_revision = "d2f6a8c4b9e0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "categories",
        sa.Column(
            "color",
            sa.String(),
            nullable=False,
            server_default="#49c5b6",
        ),
    )
    op.alter_column("categories", "color", server_default=None)


def downgrade() -> None:
    op.drop_column("categories", "color")

