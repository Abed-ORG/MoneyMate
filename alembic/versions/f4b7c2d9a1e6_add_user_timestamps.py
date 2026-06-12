"""add user timestamps

Revision ID: f4b7c2d9a1e6
Revises: 848f9cf2877b
Create Date: 2026-06-11
"""

from alembic import op
import sqlalchemy as sa


revision = "f4b7c2d9a1e6"
down_revision = "848f9cf2877b"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "users",
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )


def downgrade():
    op.drop_column("users", "updated_at")
    op.drop_column("users", "created_at")
