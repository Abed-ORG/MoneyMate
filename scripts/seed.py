# flake8: noqa
from app.auth.utils import get_password_hash
from app.db import SessionLocal
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.models.account import Account
from app.models.category import Category
from app.models.transaction import Transaction
from app.models.budget import Budget
from app.models.goal import Goal
from app.models.chat_history import ChatHistory

def create_seed_data():
    # Ensure migrations are applied before seeding. Do not call `init_db()`
    # which uses `Base.metadata.create_all()`; use `alembic upgrade head` instead.
    db = SessionLocal()
    try:
        # sample user (idempotent)
        existing = db.query(User).filter(User.email == "demo@example.com").first()
        if existing:
            # remove related demo data first
            db.query(Transaction).filter(Transaction.account_id.in_(
                db.query(Account.id).filter(Account.user_id == existing.id)
            )).delete(synchronize_session=False)
            db.query(Account).filter(Account.user_id == existing.id).delete(synchronize_session=False)
            db.query(Budget).filter(Budget.user_id == existing.id).delete(synchronize_session=False)
            db.query(Goal).filter(Goal.user_id == existing.id).delete(synchronize_session=False)
            db.query(Category).filter(Category.user_id == existing.id).delete(synchronize_session=False)
            db.query(ChatHistory).filter(ChatHistory.user_id == existing.id).delete(synchronize_session=False)
            db.query(RefreshToken).filter(RefreshToken.user_id == existing.id).delete(synchronize_session=False)
            db.delete(existing)
            db.flush()

        user = User(
            email="demo@example.com",
            hashed_password=get_password_hash("demo-password"),
            full_name="Demo User",
        )
        db.add(user)
        db.flush()

        # accounts
        checking = Account(user_id=user.id, name="Checking", type="checking", balance=1500)
        savings = Account(user_id=user.id, name="Savings", type="savings", balance=5000)
        db.add_all([checking, savings])
        db.flush()

        # categories
        groceries = Category(user_id=user.id, name="Groceries")
        housing = Category(user_id=user.id, name="Housing")
        entertainment = Category(user_id=user.id, name="Entertainment")
        db.add_all([groceries, housing, entertainment])
        db.flush()

        # budgets
        b1 = Budget(
            user_id=user.id, category_id=groceries.id,
            amount=400, month=6, year=2026
        )
        b2 = Budget(
            user_id=user.id, category_id=entertainment.id,
            amount=100, month=6, year=2026
        )
        db.add_all([b1, b2])

        # goals
        g1 = Goal(
            user_id=user.id, name="Emergency Fund",
            target_amount=10000, current_amount=500
        )
        g2 = Goal(
            user_id=user.id, name="Vacation",
            target_amount=2000, current_amount=150
        )
        db.add_all([g1, g2])

        # transactions
        t1 = Transaction(
            account_id=checking.id, category_id=groceries.id,
            amount=75.50, description="Supermarket"
        )
        t2 = Transaction(
            account_id=checking.id, category_id=housing.id,
            amount=1200, description="June rent"
        )
        t3 = Transaction(
            account_id=savings.id, category_id=None, amount=200,
            description="Transfer to savings", is_transfer=True
        )
        db.add_all([t1, t2, t3])

        # chat history
        msg1 = ChatHistory(
            user_id=user.id, role="user",
            message="How can I save more this month?"
        )
        msg2 = ChatHistory(
            user_id=user.id, role="assistant",
            message=(
                "Try reducing entertainment spend and set an "
                "automatic transfer to savings."
            )
        )
        db.add_all([msg1, msg2])

        db.commit()
        print(
            "Seed data created: demo user, accounts, categories, "
            "budgets, goals, transactions, chat history"
        )
    except Exception as e:
        db.rollback()
        print("Failed to create seed data:", e)
        raise
        db.close()


if __name__ == "__main__":
    create_seed_data()
