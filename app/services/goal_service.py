from datetime import datetime, time, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.goal import Goal
from app.schemas.goal import GoalContributionCreate, GoalCreate, GoalUpdate


class GoalNotFoundError(Exception):
    pass


def _percent(current: Decimal, target: Decimal) -> float:
    if target <= 0:
        return 0.0
    return round(float(min(current / target * 100, Decimal("100"))), 2)


def _remaining(current: Decimal, target: Decimal) -> Decimal:
    return max(target - current, Decimal("0"))


def list_goals(db: Session, user_id: int):
    goals = db.query(Goal).filter(Goal.user_id == user_id).all()
    for goal in goals:
        goal.saved_percentage = _percent(Decimal(goal.current_amount or 0), Decimal(goal.target_amount))
        goal.remaining_amount = _remaining(Decimal(goal.current_amount or 0), Decimal(goal.target_amount))
        goal.contributions = []
    return goals


def create_goal(db: Session, user_id: int, payload: GoalCreate):
    goal = Goal(
        user_id=user_id,
        name=payload.name,
        target_amount=payload.target_amount,
        current_amount=payload.current_amount,
        target_date=datetime.combine(payload.deadline, time.min) if payload.deadline else None,
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    goal.saved_percentage = _percent(Decimal(goal.current_amount or 0), Decimal(goal.target_amount))
    goal.remaining_amount = _remaining(Decimal(goal.current_amount or 0), Decimal(goal.target_amount))
    goal.contributions = []
    return goal


def update_goal(db: Session, user_id: int, goal_id: int, payload: GoalUpdate):
    goal = db.query(Goal).filter(Goal.id == goal_id, Goal.user_id == user_id).first()
    if not goal:
        raise GoalNotFoundError
    values = payload.model_dump(exclude_unset=True)
    if "deadline" in values:
        deadline = values.pop("deadline")
        values["target_date"] = datetime.combine(deadline, time.min) if deadline else None
    for field, value in values.items():
        setattr(goal, field, value)
    db.commit()
    db.refresh(goal)
    goal.saved_percentage = _percent(Decimal(goal.current_amount or 0), Decimal(goal.target_amount))
    goal.remaining_amount = _remaining(Decimal(goal.current_amount or 0), Decimal(goal.target_amount))
    goal.contributions = []
    return goal


def delete_goal(db: Session, user_id: int, goal_id: int):
    goal = db.query(Goal).filter(Goal.id == goal_id, Goal.user_id == user_id).first()
    if not goal:
        raise GoalNotFoundError
    db.delete(goal)
    db.commit()


def log_goal_contribution(db: Session, user_id: int, goal_id: int, payload: GoalContributionCreate):
    goal = db.query(Goal).filter(Goal.id == goal_id, Goal.user_id == user_id).first()
    if not goal:
        raise GoalNotFoundError
    goal.current_amount = Decimal(goal.current_amount or 0) + payload.amount
    db.commit()
    db.refresh(goal)
    goal.saved_percentage = _percent(Decimal(goal.current_amount or 0), Decimal(goal.target_amount))
    goal.remaining_amount = _remaining(Decimal(goal.current_amount or 0), Decimal(goal.target_amount))
    goal.contributions = [{
        "id": int(datetime.now(timezone.utc).timestamp() * 1000),
        "goal_id": goal.id,
        "amount": payload.amount,
        "contributed_at": payload.contributed_at or datetime.now(timezone.utc),
        "note": payload.note,
    }]
    return goal
