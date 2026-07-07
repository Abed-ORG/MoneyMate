from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.financial_profile import FinancialProfile
from app.models.income_history import MonthlyIncomeHistory


def month_start(value: date | None = None) -> date:
    current = value or date.today()
    return date(current.year, current.month, 1)


def add_months(value: date, months: int) -> date:
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    return date(year, month, 1)


def months_in_range(start_date: date, end_date: date) -> list[date]:
    current = month_start(start_date)
    last = month_start(end_date)
    months: list[date] = []
    while current <= last:
        months.append(current)
        current = add_months(current, 1)
    return months


def to_decimal_income(value: Decimal | int | float | str | None) -> Decimal:
    return Decimal(str(value or 0))


def record_monthly_income(
    db: Session,
    user_id: int,
    monthly_income: Decimal,
    effective_month: date | None = None,
) -> MonthlyIncomeHistory:
    effective = month_start(effective_month)
    existing = (
        db.query(MonthlyIncomeHistory)
        .filter(
            MonthlyIncomeHistory.user_id == user_id,
            MonthlyIncomeHistory.effective_month == effective,
        )
        .first()
    )
    if existing:
        existing.monthly_income = monthly_income
        return existing

    entry = MonthlyIncomeHistory(
        user_id=user_id,
        effective_month=effective,
        monthly_income=monthly_income,
    )
    db.add(entry)
    return entry


def _fallback_profile_income(db: Session, user_id: int) -> Decimal:
    profile = (
        db.query(FinancialProfile)
        .filter(FinancialProfile.user_id == user_id)
        .first()
    )
    if not profile:
        return Decimal("0")
    return to_decimal_income(profile.monthly_income)


def income_by_month(
    db: Session,
    user_id: int,
    start_date: date,
    end_date: date,
) -> dict[date, Decimal]:
    months = months_in_range(start_date, end_date)
    if not months:
        return {}

    history = (
        db.query(MonthlyIncomeHistory)
        .filter(
            MonthlyIncomeHistory.user_id == user_id,
            MonthlyIncomeHistory.effective_month <= months[-1],
        )
        .order_by(MonthlyIncomeHistory.effective_month.asc())
        .all()
    )

    if not history:
        current_month = month_start()
        profile_income = _fallback_profile_income(db, user_id)
        return {
            income_month: (
                profile_income
                if income_month >= current_month
                else Decimal("0")
            )
            for income_month in months
        }

    result: dict[date, Decimal] = {}
    active_income = Decimal("0")
    history_index = 0
    for income_month in months:
        while (
            history_index < len(history)
            and history[history_index].effective_month <= income_month
        ):
            active_income = to_decimal_income(
                history[history_index].monthly_income
            )
            history_index += 1
        result[income_month] = active_income
    return result


def base_income_for_period(
    db: Session,
    user_id: int,
    start_date: date,
    end_date: date,
) -> Decimal:
    return sum(
        income_by_month(db, user_id, start_date, end_date).values(),
        Decimal("0"),
    )


def income_by_month_key(
    db: Session,
    user_id: int,
    start_date: date,
    end_date: date,
) -> dict[str, Decimal]:
    return {
        income_month.isoformat()[:7]: monthly_income
        for income_month, monthly_income in income_by_month(
            db,
            user_id,
            start_date,
            end_date,
        ).items()
    }
