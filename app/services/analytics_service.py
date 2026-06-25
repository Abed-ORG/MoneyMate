from __future__ import annotations

from calendar import month_abbr
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.category import Category
from app.models.financial_profile import FinancialProfile
from app.models.transaction import Transaction
from app.schemas.analytics import (
    AnalyticsFilterAccount,
    AnalyticsFilterCategory,
    AnalyticsFilters,
    AnalyticsPercentageChange,
    AnalyticsPeriod,
    AnalyticsTotals,
    DashboardAnalyticsResponse,
    MonthlyIncomeExpense,
    NetPositionSummary,
    SpendingCategoryAnalytics,
    SpendingTrendPoint,
    TrendAggregation,
)
from app.services.transaction_service import ensure_default_categories


MONEY = Decimal("0.01")
PERCENT = Decimal("0.01")
UNCATEGORIZED_NAME = "Uncategorized"
UNCATEGORIZED_COLOR = "#8a9ca3"


class AnalyticsValidationError(ValueError):
    pass


@dataclass(frozen=True)
class TransactionAnalyticsRow:
    amount: Decimal
    occurred_at: datetime
    category_id: int | None
    category_name: str
    category_color: str


def quantize_money(value: Decimal) -> Decimal:
    return Decimal(value).quantize(MONEY, rounding=ROUND_HALF_UP)


def quantize_percent(value: Decimal) -> Decimal:
    return Decimal(value).quantize(PERCENT, rounding=ROUND_HALF_UP)


def start_of_day(value: date) -> datetime:
    return datetime.combine(value, time.min, tzinfo=timezone.utc)


def end_of_day(value: date) -> datetime:
    return datetime.combine(value, time.max, tzinfo=timezone.utc)


def normalize_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def previous_equivalent_period(
    start_date: date,
    end_date: date,
) -> tuple[date, date]:
    if start_date > end_date:
        raise AnalyticsValidationError(
            "Start date must be before or equal to end date."
        )
    duration_days = (end_date - start_date).days + 1
    previous_end = start_date - timedelta(days=1)
    previous_start = previous_end - timedelta(days=duration_days - 1)
    return previous_start, previous_end


def calculate_percentage_change(
    current: Decimal,
    previous: Decimal,
) -> AnalyticsPercentageChange:
    current = quantize_money(current)
    previous = quantize_money(previous)
    if previous == 0:
        if current == 0:
            return AnalyticsPercentageChange(
                value=None,
                label="No previous data",
                direction="no_previous_data",
            )
        return AnalyticsPercentageChange(
            value=None,
            label="New",
            direction="new",
        )

    change = quantize_percent(
        ((current - previous) / abs(previous)) * Decimal("100")
    )
    if change > 0:
        direction = "increase"
    elif change < 0:
        direction = "decrease"
    else:
        direction = "flat"
    return AnalyticsPercentageChange(
        value=change,
        label=f"{change}%",
        direction=direction,
    )


def calculate_totals(rows: list[TransactionAnalyticsRow]) -> AnalyticsTotals:
    income = sum(
        (row.amount for row in rows if row.amount > 0),
        Decimal("0"),
    )
    expenses = sum(
        (abs(row.amount) for row in rows if row.amount < 0),
        Decimal("0"),
    )
    income = quantize_money(income)
    expenses = quantize_money(expenses)
    return AnalyticsTotals(
        total_income=income,
        total_expenses=expenses,
        net_amount=quantize_money(income - expenses),
    )


def moving_average(
    values: list[Decimal],
    window: int,
) -> list[Decimal]:
    averages: list[Decimal] = []
    for index in range(len(values)):
        start = max(0, index - window + 1)
        slice_values = values[start:index + 1]
        total = sum(slice_values, Decimal("0"))
        averages.append(quantize_money(total / Decimal(len(slice_values))))
    return averages


def parse_id_list(value: str | None, field_name: str) -> list[int]:
    if not value:
        return []
    ids: list[int] = []
    for raw_item in value.split(","):
        item = raw_item.strip()
        if not item:
            continue
        try:
            numeric_id = int(item)
        except ValueError as exc:
            raise AnalyticsValidationError(
                f"{field_name} must contain numeric IDs."
            ) from exc
        if numeric_id <= 0:
            raise AnalyticsValidationError(
                f"{field_name} must contain positive IDs."
            )
        ids.append(numeric_id)
    return sorted(set(ids))


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


def analytics_filters(db: Session, user_id: int) -> AnalyticsFilters:
    categories = ensure_default_categories(db, user_id)
    db.commit()
    accounts = (
        db.query(Account)
        .filter(Account.user_id == user_id)
        .order_by(Account.name.asc())
        .all()
    )
    return AnalyticsFilters(
        categories=[
            AnalyticsFilterCategory(
                id=category.id,
                name=category.name,
                color=category.color or UNCATEGORIZED_COLOR,
            )
            for category in categories
        ],
        accounts=[
            AnalyticsFilterAccount(
                id=account.id,
                name=account.name,
                type=account.type,
                currency=account.currency or "USD",
            )
            for account in accounts
        ],
    )


def validate_owned_ids(
    db: Session,
    user_id: int,
    category_ids: list[int],
    account_ids: list[int],
) -> None:
    if category_ids:
        found = {
            row.id
            for row in db.query(Category.id)
            .filter(Category.user_id == user_id, Category.id.in_(category_ids))
            .all()
        }
        missing = set(category_ids) - found
        if missing:
            raise AnalyticsValidationError(
                "One or more category filters are invalid."
            )

    if account_ids:
        found = {
            row.id
            for row in db.query(Account.id)
            .filter(Account.user_id == user_id, Account.id.in_(account_ids))
            .all()
        }
        missing = set(account_ids) - found
        if missing:
            raise AnalyticsValidationError(
                "One or more account filters are invalid."
            )


def fetch_rows(
    db: Session,
    user_id: int,
    start_date_value: date,
    end_date_value: date,
    category_ids: list[int],
    account_ids: list[int],
) -> list[TransactionAnalyticsRow]:
    query = (
        db.query(
            Transaction.amount,
            Transaction.occurred_at,
            Transaction.category_id,
            Category.name.label("category_name"),
            Category.color.label("category_color"),
        )
        .join(Account, Transaction.account_id == Account.id)
        .outerjoin(Category, Transaction.category_id == Category.id)
        .filter(
            Account.user_id == user_id,
            Transaction.occurred_at >= start_of_day(start_date_value),
            Transaction.occurred_at <= end_of_day(end_date_value),
            or_(
                Transaction.is_transfer.is_(False),
                Transaction.is_transfer.is_(None),
            ),
        )
    )
    if account_ids:
        query = query.filter(Transaction.account_id.in_(account_ids))
    if category_ids:
        # Category filtering is intentionally expense-scoped. Income remains
        # visible in totals and monthly income so expense filters do not erase
        # the income series for categories that only apply to spending.
        query = query.filter(
            (Transaction.amount >= 0)
            | (Transaction.category_id.in_(category_ids))
        )

    rows = []
    for row in query.all():
        rows.append(
            TransactionAnalyticsRow(
                amount=Decimal(str(row.amount)),
                occurred_at=normalize_datetime(row.occurred_at),
                category_id=row.category_id,
                category_name=row.category_name or UNCATEGORIZED_NAME,
                category_color=row.category_color or UNCATEGORIZED_COLOR,
            )
        )
    return rows


def aggregate_spending_by_category(
    rows: list[TransactionAnalyticsRow],
) -> list[SpendingCategoryAnalytics]:
    totals: dict[tuple[int | None, str, str], Decimal] = {}
    for row in rows:
        if row.amount >= 0:
            continue
        key = (row.category_id, row.category_name, row.category_color)
        totals[key] = totals.get(key, Decimal("0")) + abs(row.amount)

    grand_total = sum(totals.values(), Decimal("0"))
    if grand_total == 0:
        return []

    result = []
    for (category_id, name, color), amount in totals.items():
        result.append(
            SpendingCategoryAnalytics(
                category_id=category_id,
                category_name=name,
                color=color,
                amount=quantize_money(amount),
                percentage=quantize_percent(
                    (amount / grand_total) * Decimal("100")
                ),
            )
        )
    result.sort(key=lambda item: item.amount, reverse=True)
    return result


def add_months(value: date, months: int) -> date:
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    return date(year, month, 1)


def month_key(value: date) -> str:
    return f"{value.year:04d}-{value.month:02d}"


def month_label(value: date) -> str:
    return f"{month_abbr[value.month]} {value.year}"


def monthly_income_expenses(
    rows: list[TransactionAnalyticsRow],
    end_date_value: date,
    months: int,
) -> list[MonthlyIncomeExpense]:
    months = max(1, min(months, 36))
    end_month = date(end_date_value.year, end_date_value.month, 1)
    start_month = add_months(end_month, -(months - 1))
    buckets: dict[str, dict[str, Decimal]] = {}
    month_dates = [add_months(start_month, offset) for offset in range(months)]
    for current in month_dates:
        buckets[month_key(current)] = {
            "income": Decimal("0"),
            "expenses": Decimal("0"),
        }

    for row in rows:
        current = date(row.occurred_at.year, row.occurred_at.month, 1)
        key = month_key(current)
        if key not in buckets:
            continue
        if row.amount > 0:
            buckets[key]["income"] += row.amount
        elif row.amount < 0:
            buckets[key]["expenses"] += abs(row.amount)

    return [
        MonthlyIncomeExpense(
            month=month_key(current),
            month_label=month_label(current),
            income=quantize_money(buckets[month_key(current)]["income"]),
            expenses=quantize_money(buckets[month_key(current)]["expenses"]),
            net=quantize_money(
                buckets[month_key(current)]["income"]
                - buckets[month_key(current)]["expenses"]
            ),
        )
        for current in month_dates
    ]


def week_start(value: date) -> date:
    return value - timedelta(days=value.weekday())


def trend_points(
    rows: list[TransactionAnalyticsRow],
    start_date_value: date,
    end_date_value: date,
    aggregation: TrendAggregation,
) -> list[SpendingTrendPoint]:
    if aggregation == "weekly":
        first = week_start(start_date_value)
        last = week_start(end_date_value)
        step = timedelta(days=7)
        window = 4
    else:
        first = start_date_value
        last = end_date_value
        step = timedelta(days=1)
        window = 7

    bucket_dates: list[date] = []
    current = first
    while current <= last:
        bucket_dates.append(current)
        current += step

    buckets = {item.isoformat(): Decimal("0") for item in bucket_dates}
    for row in rows:
        if row.amount >= 0:
            continue
        row_date = row.occurred_at.date()
        bucket_date = (
            week_start(row_date)
            if aggregation == "weekly"
            else row_date
        )
        key = bucket_date.isoformat()
        if key in buckets:
            buckets[key] += abs(row.amount)

    values = [
        quantize_money(buckets[item.isoformat()])
        for item in bucket_dates
    ]
    averages = moving_average(values, window)
    points: list[SpendingTrendPoint] = []
    for index, bucket_date in enumerate(bucket_dates):
        if aggregation == "weekly":
            label_end = min(bucket_date + timedelta(days=6), end_date_value)
            label_start = max(bucket_date, start_date_value)
            label = (
                f"{label_start:%b} {label_start.day} - "
                f"{label_end:%b} {label_end.day}"
            )
        else:
            label_start = label_end = bucket_date
            label = f"{bucket_date.strftime('%b')} {bucket_date.day}"
        points.append(
            SpendingTrendPoint(
                key=bucket_date.isoformat(),
                label=label,
                start_date=label_start,
                end_date=label_end,
                spending=values[index],
                moving_average=averages[index],
            )
        )
    return points


def build_dashboard_analytics(
    db: Session,
    user_id: int,
    start_date_value: date,
    end_date_value: date,
    category_ids: list[int],
    account_ids: list[int],
    trend_aggregation: TrendAggregation,
    months: int,
) -> DashboardAnalyticsResponse:
    if start_date_value > end_date_value:
        raise AnalyticsValidationError(
            "Start date must be before or equal to end date."
        )
    validate_owned_ids(db, user_id, category_ids, account_ids)
    previous_start, previous_end = previous_equivalent_period(
        start_date_value,
        end_date_value,
    )
    current_rows = fetch_rows(
        db,
        user_id,
        start_date_value,
        end_date_value,
        category_ids,
        account_ids,
    )
    previous_rows = fetch_rows(
        db,
        user_id,
        previous_start,
        previous_end,
        category_ids,
        account_ids,
    )

    current_totals = calculate_totals(current_rows)
    previous_totals = calculate_totals(previous_rows)

    return DashboardAnalyticsResponse(
        currency=get_currency(db, user_id),
        period=AnalyticsPeriod(
            start_date=start_date_value,
            end_date=end_date_value,
        ),
        previous_period=AnalyticsPeriod(
            start_date=previous_start,
            end_date=previous_end,
        ),
        summary=NetPositionSummary(
            current=current_totals,
            previous=previous_totals,
            net_change=calculate_percentage_change(
                current_totals.net_amount,
                previous_totals.net_amount,
            ),
        ),
        spending_by_category=aggregate_spending_by_category(current_rows),
        monthly_income_expenses=monthly_income_expenses(
            current_rows,
            end_date_value,
            months,
        ),
        spending_trend=trend_points(
            current_rows,
            start_date_value,
            end_date_value,
            trend_aggregation,
        ),
        filters=analytics_filters(db, user_id),
    )
