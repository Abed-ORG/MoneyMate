"""add Epic 4 financial profiles

Revision ID: d4a7e2c9
Revises: c1f2a9d8
Create Date: 2026-06-09
"""

from alembic import op
import sqlalchemy as sa


revision = "d4a7e2c9"
down_revision = "c1f2a9d8"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("UPDATE users SET full_name = 'MoneyMate User' WHERE full_name IS NULL")
    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column(
            "full_name",
            existing_type=sa.String(length=255),
            nullable=False,
        )
    op.create_table(
        "financial_profiles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("monthly_income", sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="USD"),
        sa.Column(
            "spending_categories",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'"),
        ),
        sa.Column(
            "savings_goals",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'"),
        ),
        sa.Column(
            "onboarding_completed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "onboarding_skipped",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index(
        op.f("ix_financial_profiles_id"),
        "financial_profiles",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_financial_profiles_user_id"),
        "financial_profiles",
        ["user_id"],
        unique=True,
    )


def downgrade():
    op.drop_index(
        op.f("ix_financial_profiles_user_id"),
        table_name="financial_profiles",
    )
    op.drop_index(op.f("ix_financial_profiles_id"), table_name="financial_profiles")
    op.drop_table("financial_profiles")
    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column(
            "full_name",
            existing_type=sa.String(length=255),
            nullable=True,
        )
