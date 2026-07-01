from __future__ import annotations

from calendar import month_name
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.budget import Budget
from app.models.account import Account
from app.models.category import Category
from app.models.financial_profile import FinancialProfile
from app.models.transaction import Transaction
from app.repositories.transaction_repository import transaction_repository
from app.schemas.budget import (
    BudgetAlert,
    BudgetCategory,
    BudgetCategorySummary,
    BudgetCreate,
    BudgetHistoryMonth,
    BudgetHistoryResponse,
    BudgetOverview,
    BudgetRead,
    BudgetTotals,
    BudgetUpdate,
    ProgressState,
)


class BudgetNotFoundError(Exception):
    pass


class BudgetAlreadyExistsError(Exception):
    pass


class InvalidBudgetCategoryError(Exception):
    pass


MONEY = Decimal("0.01")
PERCENT = Decimal("0.01")

DEFAULT_SPENDING_CATEGORIES = [
    "Food & Dining",
    "Transport",
    "Housing",
    "Groceries",
    "Entertainment",
    "Shopping",
    "Healthcare",
    "Utilities",
    "Education",
    "Travel",
    "Personal Care",
    "Other",
]

CATEGORY_META = {
    "Food & Dining": {
        "icon": "/category-icons/food-dining.png",
        "color": "#51f35b",
    },
    "Transport": {"icon": "/category-icons/transport.png", "color": "#26bc50"},
    "Housing": {"icon": "/category-icons/housing.png", "color": "#78ff68"},
    "Groceries": {"icon": "/category-icons/groceries.png", "color": "#9ef01a"},
    "Entertainment": {
        "icon": "/category-icons/entertainment.png",
        "color": "#f59e0b",
    },
    "Shopping": {"icon": "/category-icons/shopping.png", "color": "#fb923c"},
    "Healthcare": {
        "icon": "/category-icons/healthcare.png",
        "color": "#22c55e",
    },
    "Utilities": {"icon": "/category-icons/utilities.png", "color": "#84cc16"},
    "Education": {"icon": "/category-icons/education.png", "color": "#14b8a6"},
    "Travel": {"icon": "/category-icons/travel.png", "color": "#38bdf8"},
    "Personal Care": {
        "icon": "/category-icons/personal-care.png",
        "color": "#a3e635",
    },
    "Other": {"icon": "/category-icons/other.png", "color": "#d9f99d"},
}


def quantize_money(value: Decimal) -> Decimal:
    return Decimal(value).quantize(MONEY, rounding=ROUND_HALF_UP)


def quantize_percent(value: Decimal) -> Decimal:
    return Decimal(value).quantize(PERCENT, rounding=ROUND_HALF_UP)


def normalized_category(value: str) -> str:
    return " ".join(value.split()).casefold()


def category_meta(name: str) -> dict[str, str | None]:
    return CATEGORY_META.get(name, CATEGORY_META["Other"])


def resolve_category(
    db: Session,
    user_id: int,
    category_id: int | None,
    category_name: str | None,
) -> Category:
    if category_id is not None:
        return get_category(db, user_id, category_id)

    if not category_name:
        raise InvalidBudgetCategoryError

    normalized_name = normalized_category(category_name)
    for category in ensure_budget_categories(db, user_id):
        if normalized_category(category.name) == normalized_name:
            return category

    raise InvalidBudgetCategoryError


def get_progress_state(usage_percentage: Decimal) -> ProgressState:
    if usage_percentage < Decimal("75"):
        return "green"
    if usage_percentage <= Decimal("90"):
        return "yellow"
    return "red"


def get_budget_status(usage_percentage: Decimal, variance: Decimal) -> str:
    if variance == 0:
        return "on_budget"
    if usage_percentage >= Decimal("100"):
        return "over_budget"
    if usage_percentage >= Decimal("80"):
        return "close_to_budget"
    return "under_budget"


def previous_month(year: int, month: int) -> tuple[int, int]:
    if month == 1:
        return year - 1, 12
    return year, month - 1


def get_currency(db: Session, user_id: int) -> str:
    profile = (
        db.query(FinancialProfile)
        .filter(FinancialProfile.user_id == user_id)
        .first()
    )
    return profile.currency if profile and profile.currency else "USD"


def get_profile_category_names(db: Session, user_id: int) -> list[str]:
    profile = (
        db.query(FinancialProfile)
        .filter(FinancialProfile.user_id == user_id)
        .first()
    )
    names = profile.spending_categories if profile else []
    if not names:
        names = DEFAULT_SPENDING_CATEGORIES

    unique: list[str] = []
    seen: set[str] = set()
    for name in names:
        normalized = normalized_category(name)
        if not normalized or normalized == "income" or normalized in seen:
            continue
        seen.add(normalized)
        unique.append(" ".join(name.split()))
    return unique


def ensure_budget_categories(db: Session, user_id: int) -> list[Category]:
    existing = (
        db.query(Category)
        .filter(Category.user_id == user_id)
        .order_by(Category.name.asc())
        .all()
    )
    by_name = {
        normalized_category(category.name): category
        for category in existing
    }

    for name in get_profile_category_names(db, user_id):
        key = normalized_category(name)
        if key not in by_name:
            category = Category(user_id=user_id, name=name)
            db.add(category)
            db.flush()
            by_name[key] = category

    db.commit()
    categories = [
        category
        for category in by_name.values()
        if normalized_category(category.name) != "income"
    ]
    categories.sort(key=lambda item: item.name.lower())
    return categories


def list_budget_categories(db: Session, user_id: int) -> list[BudgetCategory]:
    return [
        BudgetCategory(
            id=category.id,
            name=category.name,
            icon=category_meta(category.name)["icon"],
            color=category_meta(category.name)["color"],
        )
        for category in ensure_budget_categories(db, user_id)
    ]


def get_category(db: Session, user_id: int, category_id: int) -> Category:
    category = (
        db.query(Category)
        .filter(Category.id == category_id, Category.user_id == user_id)
        .first()
    )
    if not category or normalized_category(category.name) == "income":
        raise InvalidBudgetCategoryError
    return category


def budget_to_schema(budget: Budget) -> BudgetRead:
    name = budget.category.name if budget.category else "Deleted category"
    meta = category_meta(name)
    return BudgetRead(
        id=budget.id,
        user_id=budget.user_id,
        category_id=budget.category_id,
        amount=budget.amount,
        month=budget.month,
        year=budget.year,
        category_name=name,
        category_icon=meta["icon"],
        category_color=meta["color"],
    )


def find_duplicate_budget(
    db: Session,
    user_id: int,
    category_id: int,
    month: int,
    year: int,
    exclude_budget_id: int | None = None,
) -> Budget | None:
    query = db.query(Budget).filter(
        Budget.user_id == user_id,
        Budget.category_id == category_id,
        Budget.month == month,
        Budget.year == year,
    )
    if exclude_budget_id is not None:
        query = query.filter(Budget.id != exclude_budget_id)
    return query.first()


def create_budget(
    db: Session,
    user_id: int,
    payload: BudgetCreate,
) -> BudgetRead:
    category = resolve_category(
        db,
        user_id,
        payload.category_id,
        payload.category_name,
    )
    if find_duplicate_budget(
        db, user_id, category.id, payload.month, payload.year
    ):
        raise BudgetAlreadyExistsError

    budget = Budget(
        user_id=user_id,
        category_id=category.id,
        amount=quantize_money(payload.amount),
        month=payload.month,
        year=payload.year,
    )
    db.add(budget)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise BudgetAlreadyExistsError from exc
    db.refresh(budget)
    return budget_to_schema(budget)


def get_budget(db: Session, user_id: int, budget_id: int) -> Budget:
    budget = (
        db.query(Budget)
        .filter(Budget.id == budget_id, Budget.user_id == user_id)
        .first()
    )
    if not budget:
        raise BudgetNotFoundError
    return budget


def read_budget(db: Session, user_id: int, budget_id: int) -> BudgetRead:
    return budget_to_schema(get_budget(db, user_id, budget_id))


def list_budgets(
    db: Session,
    user_id: int,
    month: int | None = None,
    year: int | None = None,
    category_id: int | None = None,
) -> list[BudgetRead]:
    query = db.query(Budget).filter(Budget.user_id == user_id)
    if month is not None:
        query = query.filter(Budget.month == month)
    if year is not None:
        query = query.filter(Budget.year == year)
    if category_id is not None:
        query = query.filter(Budget.category_id == category_id)
    return [
        budget_to_schema(budget)
        for budget in query.outerjoin(Category)
        .order_by(Category.name.asc())
        .all()
    ]


def update_budget(
    db: Session,
    user_id: int,
    budget_id: int,
    payload: BudgetUpdate,
) -> BudgetRead:
    budget = get_budget(db, user_id, budget_id)
    values = payload.model_dump(exclude_unset=True)
    next_category_id = values.get("category_id", budget.category_id)
    next_category_name = values.get("category_name")
    next_month = values.get("month", budget.month)
    next_year = values.get("year", budget.year)

    if "category_id" in values or "category_name" in values:
        category = resolve_category(
            db,
            user_id,
            next_category_id,
            next_category_name,
        )
        next_category_id = category.id
    if find_duplicate_budget(
        db,
        user_id,
        next_category_id,
        next_month,
        next_year,
        exclude_budget_id=budget.id,
    ):
        raise BudgetAlreadyExistsError

    for field, value in values.items():
        if field == "category_name":
            continue
        setattr(
            budget,
            field,
            quantize_money(value) if field == "amount" else value,
        )
    if "category_id" in values or "category_name" in values:
        budget.category_id = next_category_id
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise BudgetAlreadyExistsError from exc
    db.refresh(budget)
    return budget_to_schema(budget)


def delete_budget(db: Session, user_id: int, budget_id: int) -> None:
    budget = get_budget(db, user_id, budget_id)
    db.delete(budget)
    db.commit()


def copy_budgets_from_previous_month(
    db: Session,
    user_id: int,
    month: int,
    year: int,
) -> list[BudgetRead]:
    source_year, source_month = previous_month(year, month)
    source_budgets = (
        db.query(Budget)
        .filter(
            Budget.user_id == user_id,
            Budget.month == source_month,
            Budget.year == source_year,
        )
        .order_by(Budget.id.asc())
        .all()
    )
    copied: list[Budget] = []
    for source in source_budgets:
        if find_duplicate_budget(
            db,
            user_id,
            source.category_id,
            month,
            year,
        ):
            continue
        budget = Budget(
            user_id=user_id,
            category_id=source.category_id,
            amount=quantize_money(source.amount),
            month=month,
            year=year,
        )
        db.add(budget)
        copied.append(budget)
    if not copied:
        return []
    db.commit()
    for budget in copied:
        db.refresh(budget)
    return [budget_to_schema(budget) for budget in copied]


def spending_by_category(
    db: Session,
    user_id: int,
    month: int,
    year: int,
) -> dict[str, Decimal]:
    totals: dict[str, Decimal] = {}
    transactions = (
        db.query(Transaction)
        .join(Account)
        .outerjoin(Category)
        .filter(Account.user_id == user_id)
        .all()
    )
    for transaction in transactions:
        transaction_date = transaction.occurred_at
        if not transaction_date:
            continue
        if transaction_date.month != month or transaction_date.year != year:
            continue
        amount = Decimal(str(transaction.amount))
        if amount >= 0:
            continue
        category_name = (
            transaction.category.name if transaction.category else "Other"
        )
        key = normalized_category(category_name)
        totals[key] = totals.get(key, Decimal("0")) + abs(amount)

    for transaction in transaction_repository.list_by_user(str(user_id)):
        transaction_date = transaction.date
        if transaction_date.month != month or transaction_date.year != year:
            continue
        amount = Decimal(str(transaction.amount))
        if amount >= 0:
            continue
        key = normalized_category(transaction.category)
        totals[key] = totals.get(key, Decimal("0")) + abs(amount)

    return {key: quantize_money(value) for key, value in totals.items()}


def build_alert(
    summary: BudgetCategorySummary,
    month: int,
    year: int,
) -> BudgetAlert | None:
    if summary.alert_level is None:
        return None

    if summary.alert_level == "alert":
        exceeded = quantize_money(abs(summary.remaining_amount))
        message = (
            f"You have exceeded your {summary.category_name} budget "
            f"by {exceeded} for {month_name[month]} {year}."
        )
    else:
        message = (
            f"You have used {summary.usage_percentage}% of your "
            f"{summary.category_name} budget for {month_name[month]} {year}."
        )

    return BudgetAlert(
        severity=summary.alert_level,
        category_id=summary.category_id,
        category_name=summary.category_name,
        category_icon=summary.category_icon,
        category_color=summary.category_color,
        budgeted_amount=summary.budgeted_amount,
        actual_spending=summary.actual_spending,
        remaining_amount=summary.remaining_amount,
        usage_percentage=summary.usage_percentage,
        message=message,
    )


def calculate_monthly_overview(
    db: Session,
    user_id: int,
    month: int,
    year: int,
) -> BudgetOverview:
    budgets = (
        db.query(Budget)
        .filter(
            Budget.user_id == user_id,
            Budget.month == month,
            Budget.year == year,
        )
        .outerjoin(Category)
        .order_by(Category.name.asc())
        .all()
    )
    spend_map = spending_by_category(db, user_id, month, year)
    summaries: list[BudgetCategorySummary] = []

    for budget in budgets:
        category_name = (
            budget.category.name
            if budget.category
            else "Deleted category"
        )
        actual = spend_map.get(
            normalized_category(category_name),
            Decimal("0.00"),
        )
        budgeted = quantize_money(budget.amount)
        remaining = quantize_money(budgeted - actual)
        usage = (
            quantize_percent((actual / budgeted) * Decimal("100"))
            if budgeted > 0
            else Decimal("0.00")
        )
        variance = remaining
        variance_percentage = (
            quantize_percent((variance / budgeted) * Decimal("100"))
            if budgeted > 0
            else Decimal("0.00")
        )
        alert_level = None
        if usage > Decimal("100"):
            alert_level = "alert"
        elif usage >= Decimal("80"):
            alert_level = "warning"
        meta = category_meta(category_name)
        summaries.append(
            BudgetCategorySummary(
                budget_id=budget.id,
                category_id=budget.category_id,
                category_name=category_name,
                category_icon=meta["icon"],
                category_color=meta["color"],
                budgeted_amount=budgeted,
                actual_spending=actual,
                remaining_amount=remaining,
                usage_percentage=usage,
                variance_amount=variance,
                variance_percentage=variance_percentage,
                status=get_budget_status(usage, variance),
                alert_level=alert_level,
                progress_state=get_progress_state(usage),
            )
        )

    total_budgeted = quantize_money(
        sum((item.budgeted_amount for item in summaries), Decimal("0"))
    )
    total_actual = quantize_money(
        sum((item.actual_spending for item in summaries), Decimal("0"))
    )
    total_remaining = quantize_money(total_budgeted - total_actual)
    overall_usage = (
        quantize_percent((total_actual / total_budgeted) * Decimal("100"))
        if total_budgeted > 0
        else Decimal("0.00")
    )
    alerts = [
        alert
        for alert in (
            build_alert(summary, month, year)
            for summary in summaries
        )
        if alert is not None
    ]
    return BudgetOverview(
        month=month,
        year=year,
        currency=get_currency(db, user_id),
        totals=BudgetTotals(
            total_budgeted_amount=total_budgeted,
            total_actual_spending=total_actual,
            total_remaining_amount=total_remaining,
            overall_usage_percentage=overall_usage,
            categories_over_budget=sum(
                1
                for item in summaries
                if item.usage_percentage > Decimal("100")
            ),
        ),
        budgets=summaries,
        alerts=alerts,
    )


def get_budget_alerts(
    db: Session,
    user_id: int,
    month: int,
    year: int,
) -> list[BudgetAlert]:
    return calculate_monthly_overview(db, user_id, month, year).alerts


def get_budget_comparison(
    db: Session,
    user_id: int,
    month: int,
    year: int,
) -> list[BudgetCategorySummary]:
    return calculate_monthly_overview(db, user_id, month, year).budgets


def summarize_history_month(
    db: Session,
    user_id: int,
    year: int,
    month: int,
) -> tuple[BudgetOverview, Decimal]:
    overview = calculate_monthly_overview(db, user_id, month, year)
    total_categories = len(overview.budgets)
    within_budget = sum(
        1
        for item in overview.budgets
        if item.usage_percentage <= Decimal("100")
    )
    adherence = (
        quantize_percent(
            (Decimal(within_budget) / Decimal(total_categories)) * 100
        )
        if total_categories
        else Decimal("0.00")
    )
    return overview, adherence


def build_history_item(
    db: Session,
    user_id: int,
    year: int,
    month: int,
) -> BudgetHistoryMonth:
    overview, adherence = summarize_history_month(db, user_id, year, month)
    previous_year, previous_month_number = previous_month(year, month)
    previous_overview, previous_adherence = summarize_history_month(
        db,
        user_id,
        previous_year,
        previous_month_number,
    )
    has_previous_budget = bool(previous_overview.budgets)
    difference = quantize_percent(adherence - previous_adherence)

    if not has_previous_budget or difference == 0:
        trend = "no_change"
        trend_message = (
            "No previous budget data to compare."
            if not has_previous_budget
            else (
                "No meaningful change compared with "
                f"{month_name[previous_month_number]}."
            )
        )
    elif difference > 0:
        trend = "improvement"
        trend_message = (
            f"Improved by {abs(difference)} percentage points compared with "
            f"{month_name[previous_month_number]}."
        )
    else:
        trend = "decline"
        trend_message = (
            f"Declined by {abs(difference)} percentage points compared with "
            f"{month_name[previous_month_number]}."
        )

    return BudgetHistoryMonth(
        month=month,
        year=year,
        month_label=f"{month_name[month]} {year}",
        total_budgeted_amount=overview.totals.total_budgeted_amount,
        total_actual_spending=overview.totals.total_actual_spending,
        overall_usage_percentage=overview.totals.overall_usage_percentage,
        adherence_percentage=adherence,
        categories_within_budget=sum(
            1
            for item in overview.budgets
            if item.usage_percentage <= Decimal("100")
        ),
        categories_over_budget=overview.totals.categories_over_budget,
        trend=trend,
        trend_percentage_points=difference,
        trend_message=trend_message,
    )


def get_budget_history(db: Session, user_id: int) -> BudgetHistoryResponse:
    rows = (
        db.query(Budget.year, Budget.month)
        .filter(Budget.user_id == user_id)
        .distinct()
        .all()
    )
    months = sorted({(row.year, row.month) for row in rows}, reverse=True)
    return BudgetHistoryResponse(
        months=[
            build_history_item(db, user_id, year, month)
            for year, month in months
        ]
    )


def get_budget_history_detail(
    db: Session,
    user_id: int,
    year: int,
    month: int,
) -> BudgetOverview:
    return calculate_monthly_overview(db, user_id, month, year)
