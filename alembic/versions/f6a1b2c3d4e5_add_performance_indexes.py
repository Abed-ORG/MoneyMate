"""add performance indexes

Revision ID: f6a1b2c3d4e5
Revises: e1b2c3d4f5a6
Create Date: 2026-07-08
"""

from alembic import op


revision = "f6a1b2c3d4e5"
down_revision = "e1b2c3d4f5a6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index("ix_accounts_user_id", "accounts", ["user_id"])
    op.create_index("ix_budgets_user_month_year", "budgets", ["user_id", "year", "month"])
    op.create_index(
        "ix_budgets_category_month_year",
        "budgets",
        ["category_id", "year", "month"],
    )
    op.create_index("ix_categories_user_name", "categories", ["user_id", "name"])
    op.create_index("ix_goals_user_active", "goals", ["user_id", "is_active"])
    op.create_index(
        "ix_transactions_account_occurred_at",
        "transactions",
        ["account_id", "occurred_at"],
    )
    op.create_index(
        "ix_transactions_category_occurred_at",
        "transactions",
        ["category_id", "occurred_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_transactions_category_occurred_at", table_name="transactions")
    op.drop_index("ix_transactions_account_occurred_at", table_name="transactions")
    op.drop_index("ix_goals_user_active", table_name="goals")
    op.drop_index("ix_categories_user_name", table_name="categories")
    op.drop_index("ix_budgets_category_month_year", table_name="budgets")
    op.drop_index("ix_budgets_user_month_year", table_name="budgets")
    op.drop_index("ix_accounts_user_id", table_name="accounts")
