from __future__ import annotations

import re
from calendar import month_name
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.budget import Budget
from app.models.category import Category
from app.models.financial_profile import FinancialProfile
from app.models.goal import Goal
from app.models.transaction import Transaction


MONEY = Decimal("0.01")
PERCENT = Decimal("0.01")
MONTH_LOOKUP = {
    name.casefold(): index
    for index, name in enumerate(month_name)
    if name
}
MONTH_LOOKUP.update(
    {name[:3].casefold(): index for name, index in MONTH_LOOKUP.items()}
)


def quantize_money(value: Decimal) -> Decimal:
    return Decimal(value).quantize(MONEY, rounding=ROUND_HALF_UP)


def quantize_percent(value: Decimal) -> Decimal:
    return Decimal(value).quantize(PERCENT, rounding=ROUND_HALF_UP)


def to_json_money(value: Decimal) -> float:
    return float(quantize_money(value))


def start_of_day(value: date) -> datetime:
    return datetime.combine(value, time.min, tzinfo=timezone.utc)


def end_of_day(value: date) -> datetime:
    return datetime.combine(value, time.max, tzinfo=timezone.utc)


def month_bounds(today: date, previous: bool = False) -> tuple[date, date]:
    year = today.year
    month = today.month
    if previous:
        if month == 1:
            year -= 1
            month = 12
        else:
            month -= 1
    start = date(year, month, 1)
    if month == 12:
        next_month = date(year + 1, 1, 1)
    else:
        next_month = date(year, month + 1, 1)
    return start, next_month - timedelta(days=1)


def previous_period(
    start_date: date,
    end_date: date,
) -> tuple[date, date]:
    days = (end_date - start_date).days + 1
    previous_end = start_date - timedelta(days=1)
    return previous_end - timedelta(days=days - 1), previous_end


def latest_transaction_month(db: Session, user_id: int) -> date | None:
    latest_occurred_at = (
        db.query(func.max(Transaction.occurred_at))
        .join(Account)
        .filter(Account.user_id == user_id)
        .scalar()
    )
    if latest_occurred_at is None:
        return None
    return latest_occurred_at.date().replace(day=1)


def question_areas(question: str) -> set[str]:
    text = question.casefold()
    areas: set[str] = set()
    if any(
        word in text
        for word in [
            "overview",
            "summary",
            "overall",
            "finances",
            "financial",
            "money",
            "how am i doing",
            "tell me more",
        ]
    ):
        areas.add("summary")
    if any(
        word in text
        for word in [
            "spend",
            "spent",
            "expense",
            "category",
            "catgry",
            "catgory",
        ]
    ):
        areas.add("transactions")
        areas.add("categories")
    if any(word in text for word in ["income", "earn"]):
        areas.add("transactions")
    if any(word in text for word in ["net", "position", "balance"]):
        areas.add("transactions")
    if any(word in text for word in ["budget", "limit", "within"]):
        areas.add("budgets")
    if any(word in text for word in ["goal", "saving", "savings"]):
        areas.add("goals")
    if any(word in text for word in ["compare", "last", "previous"]):
        areas.add("comparison")
    if not areas:
        areas.add("transactions")
    return areas


def requested_period(
    question: str,
    today: date | None = None,
) -> tuple[date, date]:
    today = today or date.today()
    text = question.casefold()
    month_pattern = "|".join(sorted(MONTH_LOOKUP, key=len, reverse=True))
    month_match = re.search(
        rf"\b({month_pattern})\b(?:\s+(\d{{4}}))?",
        text,
    )
    if month_match:
        month = MONTH_LOOKUP[month_match.group(1)]
        year = int(month_match.group(2) or today.year)
        start = date(year, month, 1)
        if month == 12:
            end = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            end = date(year, month + 1, 1) - timedelta(days=1)
        return start, end
    if "last month" in text or "previous month" in text:
        return month_bounds(today, previous=True)
    if "today" in text:
        return today, today
    if "last 7" in text or "past week" in text:
        return today - timedelta(days=6), today
    if "last 30" in text or "past 30" in text:
        return today - timedelta(days=29), today
    start, _ = month_bounds(today)
    return start, today


def get_currency(db: Session, user_id: int) -> str:
    profile = (
        db.query(FinancialProfile)
        .filter(FinancialProfile.user_id == user_id)
        .first()
    )
    if profile and profile.currency:
        return profile.currency
    account = (
        db.query(Account)
        .filter(Account.user_id == user_id)
        .order_by(Account.id.asc())
        .first()
    )
    return account.currency if account and account.currency else "USD"


def transactions_for_period(
    db: Session,
    user_id: int,
    start_date: date,
    end_date: date,
) -> list[Transaction]:
    return (
        db.query(Transaction)
        .join(Account)
        .outerjoin(Category)
        .filter(
            Account.user_id == user_id,
            Transaction.occurred_at >= start_of_day(start_date),
            Transaction.occurred_at <= end_of_day(end_date),
        )
        .all()
    )


def summarize_transactions(
    transactions: list[Transaction],
) -> dict[str, Any]:
    income = Decimal("0")
    expenses = Decimal("0")
    category_totals: dict[str, Decimal] = {}
    largest_expenses: list[dict[str, Any]] = []
    for transaction in transactions:
        amount = Decimal(str(transaction.amount))
        if amount > 0:
            income += amount
            continue
        expense = abs(amount)
        expenses += expense
        category_name = (
            transaction.category.name if transaction.category else "Other"
        )
        category_totals[category_name] = (
            category_totals.get(category_name, Decimal("0")) + expense
        )
        largest_expenses.append(
            {
                "vendor": transaction.vendor
                or transaction.description
                or "Unknown",
                "amount": to_json_money(expense),
                "category": category_name,
                "date": (
                    transaction.occurred_at.date().isoformat()
                    if transaction.occurred_at
                    else None
                ),
            }
        )

    categories = []
    for name, total in category_totals.items():
        percentage = (
            quantize_percent(total / expenses * Decimal("100"))
            if expenses
            else Decimal("0")
        )
        categories.append(
            {
                "category": name,
                "total": to_json_money(total),
                "percentage_of_expenses": float(percentage),
            }
        )
    categories.sort(key=lambda item: item["total"], reverse=True)
    largest_expenses.sort(key=lambda item: item["amount"], reverse=True)
    return {
        "transaction_count": len(transactions),
        "income": to_json_money(income),
        "expenses": to_json_money(expenses),
        "net_amount": to_json_money(income - expenses),
        "category_totals": categories[:12],
        "largest_expenses": largest_expenses[:5],
    }


def summarize_budgets(
    db: Session,
    user_id: int,
    start_date: date,
    period_transactions: list[Transaction],
) -> list[dict[str, Any]]:
    budgets = (
        db.query(Budget)
        .outerjoin(Category)
        .filter(
            Budget.user_id == user_id,
            Budget.month == start_date.month,
            Budget.year == start_date.year,
        )
        .all()
    )
    expense_by_category: dict[int, Decimal] = {}
    for transaction in period_transactions:
        amount = Decimal(str(transaction.amount))
        if amount >= 0 or transaction.category_id is None:
            continue
        expense_by_category[transaction.category_id] = (
            expense_by_category.get(transaction.category_id, Decimal("0"))
            + abs(amount)
        )

    summaries = []
    for budget in budgets:
        spent = expense_by_category.get(budget.category_id, Decimal("0"))
        limit = Decimal(str(budget.amount))
        remaining = limit - spent
        usage = (
            quantize_percent(spent / limit * Decimal("100"))
            if limit > 0
            else Decimal("0")
        )
        summaries.append(
            {
                "category": (
                    budget.category.name
                    if budget.category
                    else "Deleted category"
                ),
                "budgeted": to_json_money(limit),
                "spent": to_json_money(spent),
                "remaining": to_json_money(remaining),
                "usage_percentage": float(usage),
            }
        )
    return summaries


def summarize_goals(db: Session, user_id: int) -> list[dict[str, Any]]:
    goals = (
        db.query(Goal)
        .filter(Goal.user_id == user_id, Goal.is_active.is_(True))
        .order_by(Goal.id.asc())
        .all()
    )
    summaries = []
    for goal in goals:
        current = Decimal(str(goal.current_amount or 0))
        target = Decimal(str(goal.target_amount or 0))
        remaining = max(target - current, Decimal("0"))
        progress = (
            quantize_percent(current / target * Decimal("100"))
            if target > 0
            else Decimal("0")
        )
        summaries.append(
            {
                "name": goal.name,
                "target_amount": to_json_money(target),
                "current_amount": to_json_money(current),
                "remaining_amount": to_json_money(remaining),
                "progress_percentage": float(progress),
                "target_date": (
                    goal.target_date.date().isoformat()
                    if goal.target_date
                    else None
                ),
            }
        )
    return summaries


def calculate_change(current: float, previous: float) -> dict[str, Any]:
    current_decimal = Decimal(str(current))
    previous_decimal = Decimal(str(previous))
    difference = quantize_money(current_decimal - previous_decimal)
    if previous_decimal == 0:
        return {
            "difference": to_json_money(difference),
            "percentage_change": None,
            "label": (
                "No previous-period data"
                if current_decimal == 0
                else "New activity"
            ),
        }
    percentage = quantize_percent(
        difference / abs(previous_decimal) * Decimal("100")
    )
    return {
        "difference": to_json_money(difference),
        "percentage_change": float(percentage),
        "label": f"{percentage}% change",
    }


def build_financial_context(
    db: Session,
    user_id: int,
    question: str,
    today: date | None = None,
) -> dict[str, Any]:
    start_date, end_date = requested_period(question, today)
    previous_start, previous_end = previous_period(start_date, end_date)
    areas = question_areas(question)
    include_summary = "summary" in areas
    include_transactions = bool(
        {"transactions", "categories", "summary"} & areas
    )
    include_budgets = "budgets" in areas or include_summary
    include_goals = "goals" in areas or include_summary
    include_comparisons = "comparison" in areas or include_summary
    transactions = (
        transactions_for_period(db, user_id, start_date, end_date)
        if include_transactions or include_budgets
        else []
    )
    if (include_transactions or include_budgets) and not transactions:
        latest_month_start = latest_transaction_month(db, user_id)
        if latest_month_start and latest_month_start != start_date:
            start_date = latest_month_start
            if start_date.month == 12:
                end_date = date(start_date.year + 1, 1, 1) - timedelta(days=1)
            else:
                end_date = (
                    date(start_date.year, start_date.month + 1, 1)
                    - timedelta(days=1)
                )
            previous_start, previous_end = previous_period(
                start_date,
                end_date,
            )
            transactions = transactions_for_period(
                db,
                user_id,
                start_date,
                end_date,
            )
    transaction_summary = (
        summarize_transactions(transactions)
        if include_transactions
        else None
    )
    previous_summary = None
    if include_transactions and include_comparisons:
        previous_transactions = transactions_for_period(
            db,
            user_id,
            previous_start,
            previous_end,
        )
        previous_summary = summarize_transactions(previous_transactions)
    context: dict[str, Any] = {
        "currency": get_currency(db, user_id),
        "question_areas": sorted(areas),
        "period": {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "label": (
                f"{month_name[start_date.month]} {start_date.year}"
                if start_date.day == 1
                else f"{start_date.isoformat()} to {end_date.isoformat()}"
            ),
        },
        "previous_period": {
            "start_date": previous_start.isoformat(),
            "end_date": previous_end.isoformat(),
        },
        "insufficient_data": [],
    }
    if transaction_summary is not None:
        context["transactions"] = transaction_summary
    if transaction_summary is not None and previous_summary is not None:
        context["previous_transactions"] = previous_summary
        context["comparisons"] = {
            "expenses": calculate_change(
                transaction_summary["expenses"],
                previous_summary["expenses"],
            ),
            "income": calculate_change(
                transaction_summary["income"],
                previous_summary["income"],
            ),
            "net_amount": calculate_change(
                transaction_summary["net_amount"],
                previous_summary["net_amount"],
            ),
        }
    if include_budgets:
        context["budgets"] = summarize_budgets(
            db,
            user_id,
            start_date,
            transactions,
        )
    if include_goals:
        context["goals"] = summarize_goals(db, user_id)
    if (
        transaction_summary is not None
        and transaction_summary["transaction_count"] == 0
    ):
        context["insufficient_data"].append(
            "No transactions were found for the selected period."
        )
    if include_budgets and not context.get("budgets"):
        context["insufficient_data"].append(
            "No budgets were found for the selected period."
        )
    if include_goals and not context.get("goals"):
        context["insufficient_data"].append(
            "No active savings goals were found."
        )
    return context


def sources_from_context(context: dict[str, Any]) -> list[dict[str, Any]]:
    period = context["period"]
    sources = []
    if context.get("transactions"):
        sources.append(
            {
                "type": "transactions",
                "label": f"{period['label']} transactions",
                "start_date": period["start_date"],
                "end_date": period["end_date"],
            }
        )
    if context.get("budgets"):
        sources.append(
            {
                "type": "budgets",
                "label": f"{period['label']} budgets",
                "start_date": period["start_date"],
                "end_date": period["end_date"],
            }
        )
    if context.get("goals"):
        sources.append({"type": "goals", "label": "Active savings goals"})
    return sources


def metrics_from_context(context: dict[str, Any]) -> dict[str, Any]:
    metrics: dict[str, Any] = {}
    transactions = context.get("transactions")
    if transactions:
        metrics.update(
            {
                "total_expenses": transactions["expenses"],
                "total_income": transactions["income"],
                "net_amount": transactions["net_amount"],
                "transaction_count": transactions["transaction_count"],
            }
        )
    if context.get("comparisons"):
        metrics["comparisons"] = context["comparisons"]
    if context.get("budgets"):
        metrics["budget_count"] = len(context["budgets"])
    if context.get("goals"):
        metrics["goal_count"] = len(context["goals"])
    return metrics
