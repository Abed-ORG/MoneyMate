"""Update category color defaults to teal.

Revision ID: f0a9c8d7e6b5
Revises: e5a1c9d7b2f4
Create Date: 2026-06-22
"""

from alembic import op


revision = "f0a9c8d7e6b5"
down_revision = "e5a1c9d7b2f4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE categories
        SET color = '#49c5b6'
        WHERE lower(color) IN ('#aafc75', '#69f56a')
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE categories
        SET color = '#AAFC75'
        WHERE lower(color) = '#49c5b6'
        """
    )
