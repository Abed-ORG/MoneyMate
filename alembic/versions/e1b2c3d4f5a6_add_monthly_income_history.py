"""add monthly income history

Revision ID: e1b2c3d4f5a6
Revises: d3e5f7a9b1c2
Create Date: 2026-07-07
"""

from datetime import date

from alembic import op
import sqlalchemy as sa


revision = "e1b2c3d4f5a6"
down_revision = "d3e5f7a9b1c2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "monthly_income_history",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("effective_month", sa.Date(), nullable=False),
        sa.Column("monthly_income", sa.Numeric(14, 2), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "effective_month",
            name="uq_monthly_income_history_user_month",
        ),
    )
    op.create_index(
        op.f("ix_monthly_income_history_id"),
        "monthly_income_history",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_monthly_income_history_user_id"),
        "monthly_income_history",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_monthly_income_history_effective_month"),
        "monthly_income_history",
        ["effective_month"],
        unique=False,
    )

    bind = op.get_bind()
    current_month = date.today().replace(day=1)
    profiles = sa.table(
        "financial_profiles",
        sa.column("user_id", sa.Integer()),
        sa.column("monthly_income", sa.Numeric(14, 2)),
    )
    income_history = sa.table(
        "monthly_income_history",
        sa.column("user_id", sa.Integer()),
        sa.column("effective_month", sa.Date()),
        sa.column("monthly_income", sa.Numeric(14, 2)),
    )
    rows = bind.execute(
        sa.select(profiles.c.user_id, profiles.c.monthly_income).where(
            profiles.c.monthly_income.is_not(None)
        )
    ).fetchall()
    if rows:
        op.bulk_insert(
            income_history,
            [
                {
                    "user_id": row.user_id,
                    "effective_month": current_month,
                    "monthly_income": row.monthly_income,
                }
                for row in rows
            ],
        )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_monthly_income_history_effective_month"),
        table_name="monthly_income_history",
    )
    op.drop_index(
        op.f("ix_monthly_income_history_user_id"),
        table_name="monthly_income_history",
    )
    op.drop_index(
        op.f("ix_monthly_income_history_id"),
        table_name="monthly_income_history",
    )
    op.drop_table("monthly_income_history")
