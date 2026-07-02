# flake8: noqa
from datetime import datetime

from app.auth.utils import get_password_hash
from app.db import SessionLocal
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.models.account import Account
from app.models.category import Category
from app.models.transaction import Transaction
from app.models.budget import Budget
from app.models.goal import Goal, GoalContribution
from app.models.chat_history import ChatHistory


def create_seed_data():
    # Ensure migrations are applied before seeding. Do not call `init_db()`
    # which uses `Base.metadata.create_all()`.
    db = SessionLocal()
    try:
        existing = (
            db.query(User)
            .filter(User.email == "demo@example.com")
            .first()
        )
        if existing:
            account_ids = db.query(Account.id).filter(
                Account.user_id == existing.id
            )
            db.query(Transaction).filter(
                Transaction.account_id.in_(account_ids)
            ).delete(synchronize_session=False)
            db.query(Account).filter(
                Account.user_id == existing.id
            ).delete(synchronize_session=False)
            db.query(Budget).filter(
                Budget.user_id == existing.id
            ).delete(synchronize_session=False)
            db.query(GoalContribution).filter(
                GoalContribution.goal_id.in_(db.query(Goal.id).filter(Goal.user_id == existing.id))
            ).delete(synchronize_session=False)
            db.query(Goal).filter(
                Goal.user_id == existing.id
            ).delete(synchronize_session=False)
            db.query(Category).filter(
                Category.user_id == existing.id
            ).delete(synchronize_session=False)
            db.query(ChatHistory).filter(
                ChatHistory.user_id == existing.id
            ).delete(synchronize_session=False)
            db.query(RefreshToken).filter(
                RefreshToken.user_id == existing.id
            ).delete(synchronize_session=False)
            db.delete(existing)
            db.flush()

        user = User(
            email="demo@example.com",
            hashed_password=get_password_hash("demo-password"),
            full_name="Demo User",
        )
        db.add(user)
        db.flush()

        checking = Account(
            user_id=user.id,
            name="Checking",
            type="checking",
            balance=5420,
        )
        savings = Account(
            user_id=user.id,
            name="Savings",
            type="savings",
            balance=8400,
        )
        db.add_all([checking, savings])
        db.flush()

        groceries = Category(user_id=user.id, name="Groceries")
        housing = Category(user_id=user.id, name="Housing")
        entertainment = Category(user_id=user.id, name="Entertainment")
        transport = Category(user_id=user.id, name="Transportation")
        utilities = Category(user_id=user.id, name="Utilities")
        db.add_all([groceries, housing, entertainment, transport, utilities])
        db.flush()

        def shift_months(start: datetime, months: int) -> datetime:
            year = start.year + (start.month - 1 + months) // 12
            month = (start.month - 1 + months) % 12 + 1
            return start.replace(year=year, month=month)

        today = datetime.utcnow().replace(day=1, hour=12, minute=0, second=0, microsecond=0)
        monthly_budget_targets = {
            "Groceries": [420, 455, 430, 440, 460, 480],
            "Housing": [1350, 1350, 1400, 1400, 1450, 1450],
            "Entertainment": [180, 160, 200, 220, 190, 210],
            "Transportation": [120, 110, 140, 130, 125, 135],
            "Utilities": [90, 95, 92, 88, 100, 98],
        }

        for index in range(6):
            month_date = shift_months(today, -index)
            month = month_date.month
            year = month_date.year
            for category_name, amount in monthly_budget_targets.items():
                category = {
                    "Groceries": groceries,
                    "Housing": housing,
                    "Entertainment": entertainment,
                    "Transportation": transport,
                    "Utilities": utilities,
                }[category_name]
                db.add(
                    Budget(
                        user_id=user.id,
                        category_id=category.id,
                        amount=amount[index],
                        month=month,
                        year=year,
                    )
                )

            transaction_specs = [
                (groceries.id, 84 + index * 2, "Whole Foods", f"Weekly groceries for {month_date.strftime('%B')}"),
                (groceries.id, 41 + index, "Trader Joe's", "Produce and pantry staples"),
                (housing.id, 1280 + index, "Rent", "Monthly rent payment"),
                (utilities.id, 94 + index, "Utility bill", "Electricity and water"),
                (transport.id, 34 + index, "MetroCard", "Commuter transit pass"),
                (entertainment.id, 58 + index, "Cinema night", "Movie and dinner outing"),
            ]
            for category_id, amount, vendor, notes in transaction_specs:
                db.add(
                    Transaction(
                        account_id=checking.id,
                        category_id=category_id,
                        amount=amount,
                        description=vendor,
                        vendor=vendor,
                        notes=notes,
                        occurred_at=month_date.replace(day=3 + (category_id % 3), hour=9),
                        type="expense",
                    )
                )

        db.add(
            Transaction(
                account_id=savings.id,
                category_id=None,
                amount=350,
                description="Transfer to savings",
                vendor="Savings transfer",
                notes="Automated transfer",
                occurred_at=today.replace(day=1, hour=10),
                is_transfer=True,
                type="income",
            )
        )

        goals = [
            Goal(
                user_id=user.id,
                name="Emergency Fund",
                target_amount=12000,
                current_amount=3240,
                start_date=shift_months(today, -6),
                target_date=shift_months(today, 18),
                linked_account="Savings",
            ),
            Goal(
                user_id=user.id,
                name="Vacation",
                target_amount=2600,
                current_amount=860,
                start_date=shift_months(today, -4),
                target_date=shift_months(today, 8),
                linked_account="Checking",
            ),
            Goal(
                user_id=user.id,
                name="Home Office",
                target_amount=4200,
                current_amount=1320,
                start_date=shift_months(today, -5),
                target_date=shift_months(today, 10),
                linked_account="Savings",
            ),
        ]
        db.add_all(goals)
        db.flush()

        for goal, contribution_amounts in zip(
            goals,
            [
                [300, 250, 320, 280, 310, 290],
                [120, 90, 115, 100, 130, 105],
                [200, 180, 220, 190, 240, 290],
            ],
        ):
            for index, amount in enumerate(contribution_amounts):
                db.add(
                    GoalContribution(
                        goal_id=goal.id,
                        amount=amount,
                        contributed_at=shift_months(today, -(5 - index)),
                        note="Automatic transfer",
                    )
                )

        msg1 = ChatHistory(
            user_id=user.id,
            role="user",
            message="How can I save more this month?",
        )
        msg2 = ChatHistory(
            user_id=user.id,
            role="assistant",
            message=(
                "Your spending looks steady, and the demo data shows you are "
                "closer to your emergency fund target than last quarter."
            ),
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
    finally:
        db.close()


if __name__ == "__main__":
    create_seed_data()
