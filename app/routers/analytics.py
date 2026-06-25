from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.analytics import DashboardAnalyticsResponse, TrendAggregation
from app.services.analytics_service import (
    AnalyticsValidationError,
    build_dashboard_analytics,
    parse_id_list,
)


router = APIRouter()


def default_start_date() -> date:
    today = date.today()
    return today.replace(day=1)


@router.get("/dashboard", response_model=DashboardAnalyticsResponse)
def dashboard_analytics(
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    category_ids: str | None = Query(None),
    account_ids: str | None = Query(None),
    trend_aggregation: TrendAggregation = "daily",
    months: int = Query(12, ge=1, le=36),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return build_dashboard_analytics(
            db=db,
            user_id=current_user.id,
            start_date_value=start_date or default_start_date(),
            end_date_value=end_date or date.today(),
            category_ids=parse_id_list(category_ids, "category_ids"),
            account_ids=parse_id_list(account_ids, "account_ids"),
            trend_aggregation=trend_aggregation,
            months=months,
        )
    except AnalyticsValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
