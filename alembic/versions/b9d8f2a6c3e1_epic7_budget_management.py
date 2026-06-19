"""add Epic 7 monthly budgets

Revision ID: b9d8f2a6c3e1
Revises: a7c9e2f4b1d6
Create Date: 2026-06-19
"""

from alembic import op
import sqlalchemy as sa


revision = "b9d8f2a6c3e1"
down_revision = "a7c9e2f4b1d6"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("budgets") as batch_op:
        batch_op.add_column(sa.Column("user_id", sa.Integer(), nullable=True))
        batch_op.add_column(
            sa.Column(
                "month",
                sa.Integer(),
                nullable=False,
                server_default="6",
            )
        )
        batch_op.add_column(
            sa.Column(
                "year",
                sa.Integer(),
                nullable=False,
                server_default="2026",
            )
        )
        batch_op.add_column(
            sa.Column(
                "created_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.func.now(),
            )
        )
        batch_op.add_column(
            sa.Column(
                "updated_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.func.now(),
            )
        )

    op.execute(
        sa.text(
            """
            UPDATE budgets
            SET user_id = (
                SELECT categories.user_id
                FROM categories
                WHERE categories.id = budgets.category_id
            )
            WHERE user_id IS NULL
            """
        )
    )
    op.execute(
        sa.text(
            "DELETE FROM budgets "
            "WHERE user_id IS NULL OR category_id IS NULL"
        )
    )

    with op.batch_alter_table("budgets") as batch_op:
        batch_op.alter_column(
            "user_id",
            existing_type=sa.Integer(),
            nullable=False,
        )
        batch_op.alter_column(
            "category_id",
            existing_type=sa.Integer(),
            nullable=False,
        )
        batch_op.alter_column("month", server_default=None)
        batch_op.alter_column("year", server_default=None)
        batch_op.create_foreign_key(
            "fk_budgets_user_id_users",
            "users",
            ["user_id"],
            ["id"],
        )
        batch_op.create_unique_constraint(
            "uq_budgets_user_category_month_year",
            ["user_id", "category_id", "month", "year"],
        )
        batch_op.drop_column("period")
        batch_op.drop_column("start_date")
        batch_op.drop_column("end_date")


def downgrade():
    with op.batch_alter_table("budgets") as batch_op:
        batch_op.add_column(sa.Column("period", sa.String(), nullable=True))
        batch_op.add_column(
            sa.Column("start_date", sa.DateTime(), nullable=True)
        )
        batch_op.add_column(
            sa.Column("end_date", sa.DateTime(), nullable=True)
        )

    op.execute(
        sa.text(
            "UPDATE budgets SET period = 'monthly' "
            "WHERE period IS NULL"
        )
    )

    with op.batch_alter_table("budgets") as batch_op:
        batch_op.drop_constraint(
            "uq_budgets_user_category_month_year",
            type_="unique",
        )
        batch_op.drop_constraint(
            "fk_budgets_user_id_users",
            type_="foreignkey",
        )
        batch_op.alter_column(
            "period",
            existing_type=sa.String(),
            nullable=False,
        )
        batch_op.alter_column(
            "category_id",
            existing_type=sa.Integer(),
            nullable=True,
        )
        batch_op.drop_column("updated_at")
        batch_op.drop_column("created_at")
        batch_op.drop_column("year")
        batch_op.drop_column("month")
        batch_op.drop_column("user_id")
