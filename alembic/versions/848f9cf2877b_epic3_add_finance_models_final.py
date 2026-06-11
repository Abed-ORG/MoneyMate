# flake8: noqa
"""
Revision ID: 848f9cf2877b
Revises: 4fe9afa2c65c
Create Date: 2026-06-05 13:12:15.188929
"""

# revision identifiers, used by Alembic.
revision = '848f9cf2877b'
down_revision = 'b3831b707eda'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa

def upgrade():
    op.create_table(
        'accounts',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('type', sa.String(), nullable=False),
        sa.Column('balance', sa.Numeric(14, 2), server_default='0'),
        sa.Column('currency', sa.String(), server_default='USD'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )

    op.create_table(
        'categories',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('parent_id', sa.Integer(), sa.ForeignKey('categories.id'), nullable=True),
    )

    op.create_table(
        'chat_history',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('role', sa.String(), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )

    op.create_table(
        'goals',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('target_amount', sa.Numeric(14, 2), nullable=False),
        sa.Column('current_amount', sa.Numeric(14, 2), server_default='0'),
        sa.Column('target_date', sa.DateTime(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.sql.expression.true()),
    )

    op.create_table(
        'budgets',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('category_id', sa.Integer(), sa.ForeignKey('categories.id'), nullable=True),
        sa.Column('amount', sa.Numeric(14, 2), nullable=False),
        sa.Column('period', sa.String(), nullable=False),
        sa.Column('start_date', sa.DateTime(), nullable=True),
        sa.Column('end_date', sa.DateTime(), nullable=True),
    )

    op.create_table(
        'transactions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('account_id', sa.Integer(), sa.ForeignKey('accounts.id'), nullable=False),
        sa.Column('category_id', sa.Integer(), sa.ForeignKey('categories.id'), nullable=True),
        sa.Column('amount', sa.Numeric(14, 2), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('occurred_at', sa.DateTime(), nullable=True),
        sa.Column('is_transfer', sa.Boolean(), server_default=sa.sql.expression.false()),
    )

    # Note: do not drop existing tables here; refresh_tokens and items are
    # created by later migrations or may be present. Removing DROP TABLE
    # ensures migrations run in the correct order without destructive ops.

def downgrade():
    # drop new tables
    op.drop_table('transactions')
    op.drop_table('budgets')
    op.drop_table('goals')
    op.drop_table('chat_history')
    op.drop_table('categories')
    op.drop_table('accounts')

    # note: recreating removed tables (`items`, `refresh_tokens`) is omitted
    # to avoid guessing original schema. Add recreation code here if needed.
