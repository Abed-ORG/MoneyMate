"""add email verification fields

Revision ID: e8c1b4f2
Revises: d4a7e2c9
Create Date: 2026-06-09
"""

from alembic import op
import sqlalchemy as sa


revision = "e8c1b4f2"
down_revision = "d4a7e2c9"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "users",
        sa.Column(
            "is_email_verified",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "users",
        sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute(
        sa.text(
            "UPDATE users SET is_email_verified = true, "
            "email_verified_at = CURRENT_TIMESTAMP"
        )
    )


def downgrade():
    op.drop_column("users", "email_verified_at")
    op.drop_column("users", "is_email_verified")
