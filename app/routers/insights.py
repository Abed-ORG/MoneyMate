from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.insights import (
    AnomalyDetectionResponse,
    MonthlySummaryResponse,
    RecurringDetectionResponse,
    SpendingInsightResponse,
)
from app.services.gemini_service import (
    analyze_spending_insights,
    detect_anomalies,
    detect_recurring_transactions,
    generate_monthly_summary,
)
from app.repositories.transaction_repository import transaction_repository

router = APIRouter()


def _transactions_as_dicts(current_user: User) -> list[dict]:
    """Fetch user transactions as plain dicts for AI functions."""
    txs = transaction_repository.list_by_user(str(current_user.id))
    return [
        {
            "id": tx.id,
            "vendor": tx.vendor,
            "amount": float(tx.amount),
            "category": tx.category,
            "date": (
                tx.date.isoformat()
                if hasattr(tx.date, "isoformat")
                else str(tx.date)
            ),
        }
        for tx in txs
    ]


@router.post("/insights/spending", response_model=SpendingInsightResponse)
def spending_insights(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Analyze spending patterns with AI (Gemini, or heuristic fallback)."""
    txs = _transactions_as_dicts(current_user)
    return analyze_spending_insights(txs)


@router.post("/insights/recurring", response_model=RecurringDetectionResponse)
def recurring_insights(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Detect recurring transactions and subscriptions using AI."""
    txs = _transactions_as_dicts(current_user)
    return detect_recurring_transactions(txs)


@router.post("/insights/anomalies", response_model=AnomalyDetectionResponse)
def anomaly_insights(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Detect unusual or anomalous spending using AI."""
    txs = _transactions_as_dicts(current_user)
    return detect_anomalies(txs)


@router.post(
    "/insights/monthly-summary", response_model=MonthlySummaryResponse
)
def monthly_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate a monthly financial health summary using AI."""
    txs = _transactions_as_dicts(current_user)
    return generate_monthly_summary(txs)
