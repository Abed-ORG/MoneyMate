from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.goal import (
    GoalAICalculationRequest,
    GoalAICalculationResponse,
    GoalContributionCreate,
    GoalCreate,
    GoalListResponse,
    GoalProjectionResponse,
    GoalRead,
    GoalUpdate,
)
from app.services.goal_service import (
    GoalNotFoundError,
    create_goal,
    delete_goal,
    list_goals,
    log_goal_contribution,
    update_goal,
)
from app.services.gemini_service import (
    calculate_goal_savings,
    calculate_goal_projection,
)

router = APIRouter()


@router.get("", response_model=GoalListResponse)
def read_goals(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return {"items": list_goals(db, current_user.id)}


@router.post("", response_model=GoalRead, status_code=status.HTTP_201_CREATED)
def add_goal(
    payload: GoalCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return create_goal(db, current_user.id, payload)


@router.patch("/{goal_id}", response_model=GoalRead)
def edit_goal(
    goal_id: int,
    payload: GoalUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return update_goal(db, current_user.id, goal_id, payload)
    except GoalNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goal not found.",
        )


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_goal(
    goal_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        delete_goal(db, current_user.id, goal_id)
    except GoalNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goal not found.",
        )


@router.post("/{goal_id}/contributions", response_model=GoalRead)
def add_contribution(
    goal_id: int,
    payload: GoalContributionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return log_goal_contribution(db, current_user.id, goal_id, payload)
    except GoalNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goal not found.",
        )


@router.post("/ai/calculate", response_model=GoalAICalculationResponse)
def ai_calculate_savings(
    payload: GoalAICalculationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """AI savings calculator: required monthly to meet goal deadline."""
    return calculate_goal_savings(payload)


@router.post("/ai/projection", response_model=GoalProjectionResponse)
def ai_projection(
    payload: GoalAICalculationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """AI-powered goal timeline projection: month-by-month savings curve."""
    return calculate_goal_projection(payload)
