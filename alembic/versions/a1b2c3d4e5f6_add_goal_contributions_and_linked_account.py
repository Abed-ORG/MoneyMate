# flake8: noqa
"""
Add goal_contributions table and linked_account column to goals.

Revision ID: a1b2c3d4e5f6
Revises: 848f9cf2877b
Create Date: 2026-06-24 15:40:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "848f9cf2877b"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    goal_columns = {column["name"] for column in inspector.get_columns("goals")}

    if "linked_account" not in goal_columns:
        op.add_column(
            "goals",
            sa.Column("linked_account", sa.String(), nullable=True),
        )

    if "goal_contributions" not in inspector.get_table_names():
        op.create_table(
            "goal_contributions",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "goal_id",
                sa.Integer(),
                sa.ForeignKey("goals.id"),
                nullable=False,
            ),
            sa.Column("amount", sa.Numeric(14, 2), nullable=False),
            sa.Column("contributed_at", sa.DateTime(), nullable=False),
            sa.Column("note", sa.Text(), nullable=True),
        )


def downgrade():
    op.drop_table("goal_contributions")
    op.drop_column("goals", "linked_account")
