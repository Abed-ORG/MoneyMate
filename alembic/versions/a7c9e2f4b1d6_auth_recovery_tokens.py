"""add authentication recovery token fields

Revision ID: a7c9e2f4b1d6
Revises: f4b7c2d9a1e6
Create Date: 2026-06-14
"""

from alembic import op
import sqlalchemy as sa


revision = "a7c9e2f4b1d6"
down_revision = "f4b7c2d9a1e6"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "users",
        sa.Column(
            "email_verification_token_hash",
            sa.String(length=64),
            nullable=True,
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "email_verification_expires_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "password_reset_token_hash",
            sa.String(length=64),
            nullable=True,
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "password_reset_expires_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_users_email_verification_token_hash",
        "users",
        ["email_verification_token_hash"],
        unique=False,
    )
    op.create_index(
        "ix_users_password_reset_token_hash",
        "users",
        ["password_reset_token_hash"],
        unique=False,
    )


def downgrade():
    op.drop_index(
        "ix_users_password_reset_token_hash",
        table_name="users",
    )
    op.drop_index(
        "ix_users_email_verification_token_hash",
        table_name="users",
    )
    op.drop_column("users", "password_reset_expires_at")
    op.drop_column("users", "password_reset_token_hash")
    op.drop_column("users", "email_verification_expires_at")
    op.drop_column("users", "email_verification_token_hash")
