"""persist transaction details

Revision ID: d2f6a8c4b9e0
Revises: b9d8f2a6c3e1
Create Date: 2026-06-22
"""

from alembic import op
import sqlalchemy as sa


revision = "d2f6a8c4b9e0"
down_revision = "b9d8f2a6c3e1"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("transactions") as batch_op:
        batch_op.add_column(sa.Column("vendor", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("notes", sa.Text(), nullable=True))
        batch_op.add_column(
            sa.Column(
                "updated_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.func.now(),
            )
        )
        batch_op.add_column(
            sa.Column("ai_category", sa.String(), nullable=True)
        )
        batch_op.add_column(
            sa.Column("ai_confidence", sa.Integer(), nullable=True)
        )
        batch_op.add_column(
            sa.Column("ai_provider", sa.String(), nullable=True)
        )
        batch_op.add_column(
            sa.Column("ai_rationale", sa.Text(), nullable=True)
        )
        batch_op.add_column(sa.Column("history", sa.JSON(), nullable=True))

    op.execute(
        sa.text(
            """
            UPDATE transactions
            SET
                vendor = COALESCE(vendor, description, ''),
                notes = COALESCE(notes, ''),
                ai_category = COALESCE(ai_category, 'Other'),
                ai_confidence = COALESCE(ai_confidence, 0),
                ai_provider = COALESCE(ai_provider, 'legacy'),
                ai_rationale = COALESCE(ai_rationale, ''),
                history = COALESCE(history, '[]'::json)
            """
        )
    )


def downgrade():
    with op.batch_alter_table("transactions") as batch_op:
        batch_op.drop_column("history")
        batch_op.drop_column("ai_rationale")
        batch_op.drop_column("ai_provider")
        batch_op.drop_column("ai_confidence")
        batch_op.drop_column("ai_category")
        batch_op.drop_column("updated_at")
        batch_op.drop_column("notes")
        batch_op.drop_column("vendor")
