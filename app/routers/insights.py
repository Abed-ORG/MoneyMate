from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import (
    get_current_user,
    get_db,
)
from app.models.user import User
from app.schemas.insights import (
    AnomalyDetectionResponse,
    MonthlySummaryResponse,
    RecurringDetectionResponse,
    SpendingInsightResponse,
)
from app.services.insights_ai_service import (
    analyze_spending_insights,
    detect_anomalies,
    detect_recurring_transactions,
    generate_monthly_summary,
)
from app.models.transaction import Transaction
from app.models.category import Category

router = APIRouter()


def _transactions_as_dicts(db: Session, user_id: int) -> list[dict]:
    """Fetch user transactions from the database as plain dicts for AI functions."""
    txs = (
        db.query(Transaction)
        .join(Category, Transaction.category_id == Category.id, isouter=True)
        .filter(Transaction.account.has(user_id=user_id))
        .order_by(Transaction.occurred_at.desc())
        .all()
    )
    return [
        {
            "id": tx.id,
            "vendor": tx.vendor or "",
            "amount": float(tx.amount or 0),
            "category": tx.category.name if tx.category else "Other",
            "date": (
                tx.occurred_at.isoformat()
                if hasattr(tx.occurred_at, "isoformat")
                else str(tx.occurred_at)
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
    txs = _transactions_as_dicts(db, current_user.id)
    return analyze_spending_insights(txs)


@router.post("/insights/recurring", response_model=RecurringDetectionResponse)
def recurring_insights(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Detect recurring transactions and subscriptions using AI."""
    txs = _transactions_as_dicts(db, current_user.id)
    return detect_recurring_transactions(txs)


@router.post("/insights/anomalies", response_model=AnomalyDetectionResponse)
def anomaly_insights(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Detect unusual or anomalous spending using AI."""
    txs = _transactions_as_dicts(db, current_user.id)
    return detect_anomalies(txs)


@router.post(
    "/insights/monthly-summary", response_model=MonthlySummaryResponse
)
def monthly_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate a monthly financial health summary using AI."""
    txs = _transactions_as_dicts(db, current_user.id)
    return generate_monthly_summary(txs)
