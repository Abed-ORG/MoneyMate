"""add Epic 11 chat conversations

Revision ID: c6e3f9a2b8d1
Revises: f0a9c8d7e6b5, a1b2c3d4e5f6
Create Date: 2026-06-24
"""

from alembic import op
import sqlalchemy as sa


revision = "c6e3f9a2b8d1"
down_revision = ("f0a9c8d7e6b5", "a1b2c3d4e5f6")
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "chat_conversations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column(
            "title",
            sa.String(length=120),
            nullable=False,
            server_default="New conversation",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("last_message_at", sa.DateTime(), nullable=True),
        sa.Column(
            "is_archived",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_chat_conversations_id"),
        "chat_conversations",
        ["id"],
        unique=False,
    )
    op.create_index(
        "ix_chat_conversations_user_last_message",
        "chat_conversations",
        ["user_id", "last_message_at"],
        unique=False,
    )

    op.create_table(
        "chat_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("conversation_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("sources", sa.JSON(), nullable=True),
        sa.Column("metrics", sa.JSON(), nullable=True),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="complete",
        ),
        sa.Column("error_code", sa.String(length=80), nullable=True),
        sa.ForeignKeyConstraint(
            ["conversation_id"],
            ["chat_conversations.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_chat_messages_id"),
        "chat_messages",
        ["id"],
        unique=False,
    )
    op.create_index(
        "ix_chat_messages_conversation_created",
        "chat_messages",
        ["conversation_id", "created_at", "id"],
        unique=False,
    )


def downgrade():
    op.drop_index(
        "ix_chat_messages_conversation_created",
        table_name="chat_messages",
    )
    op.drop_index(op.f("ix_chat_messages_id"), table_name="chat_messages")
    op.drop_table("chat_messages")
    op.drop_index(
        "ix_chat_conversations_user_last_message",
        table_name="chat_conversations",
    )
    op.drop_index(
        op.f("ix_chat_conversations_id"),
        table_name="chat_conversations",
    )
    op.drop_table("chat_conversations")
