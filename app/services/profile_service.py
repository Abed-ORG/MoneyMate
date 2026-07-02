from datetime import datetime, timezone

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.services import (
    DuplicateEmailError,
    normalize_email,
)
from app.auth.utils import (
    get_password_hash,
    verify_password,
)
from app.models.account import Account
from app.models.budget import Budget
from app.models.category import Category
from app.models.chat_history import (
    ChatConversation,
    ChatHistory,
    ChatMessage,
)
from app.models.financial_profile import FinancialProfile
from app.models.goal import Goal, GoalContribution
from app.models.refresh_token import RefreshToken
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.financial_profile import (
    FinancialProfilePayload,
    FinancialProfileUpdate,
)
from app.schemas.user import PasswordChange, UserUpdate


class InvalidCurrentPasswordError(Exception):
    pass


def serialize_goals(goals):
    return [
        {
            "name": goal.name,
            "target_amount": float(goal.target_amount),
        }
        for goal in goals
    ]


def get_or_create_financial_profile(
    db: Session, user_id: int
) -> FinancialProfile:
    profile = (
        db.query(FinancialProfile)
        .filter(FinancialProfile.user_id == user_id)
        .first()
    )
    if profile:
        return profile

    profile = FinancialProfile(user_id=user_id)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def complete_onboarding(
    db: Session,
    user_id: int,
    payload: FinancialProfilePayload,
) -> FinancialProfile:
    profile = get_or_create_financial_profile(db, user_id)
    values = payload.model_dump()
    if "savings_goals" in values and payload.savings_goals is not None:
        values["savings_goals"] = serialize_goals(payload.savings_goals)
    for field, value in values.items():
        setattr(profile, field, value)
    profile.onboarding_completed = True
    profile.onboarding_skipped = False
    db.commit()
    db.refresh(profile)
    return profile


def skip_onboarding(db: Session, user_id: int) -> FinancialProfile:
    profile = get_or_create_financial_profile(db, user_id)
    profile.onboarding_skipped = True
    db.commit()
    db.refresh(profile)
    return profile


def update_financial_profile(
    db: Session,
    user_id: int,
    payload: FinancialProfileUpdate,
) -> FinancialProfile:
    profile = get_or_create_financial_profile(db, user_id)
    values = payload.model_dump(exclude_unset=True)
    if "savings_goals" in values and payload.savings_goals is not None:
        values["savings_goals"] = serialize_goals(payload.savings_goals)
    for field, value in values.items():
        setattr(profile, field, value)
    db.commit()
    db.refresh(profile)
    return profile


def update_account(
    db: Session,
    user: User,
    payload: UserUpdate,
) -> User:
    values = payload.model_dump(exclude_unset=True)
    email_changed = False
    if "email" in values:
        values["email"] = normalize_email(values["email"])
        email_changed = values["email"] != user.email
    for field, value in values.items():
        setattr(user, field, value)
    if email_changed:
        user.is_email_verified = True
        user.email_verified_at = datetime.now(timezone.utc)
        user.email_verification_token_hash = None
        user.email_verification_expires_at = None
        (
            db.query(RefreshToken)
            .filter(
                RefreshToken.user_id == user.id,
                RefreshToken.revoked.is_(False),
            )
            .update({"revoked": True}, synchronize_session=False)
        )
    try:
        db.flush()
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise DuplicateEmailError from exc
    db.refresh(user)
    return user


def change_password(db: Session, user: User, payload: PasswordChange) -> None:
    if not verify_password(payload.current_password, user.hashed_password):
        raise InvalidCurrentPasswordError
    if verify_password(payload.new_password, user.hashed_password):
        raise ValueError(
            "Your new password must be different from your current password."
        )
    user.hashed_password = get_password_hash(payload.new_password)
    user.password_reset_token_hash = None
    user.password_reset_expires_at = None
    db.add(user)
    (
        db.query(RefreshToken)
        .filter(
            RefreshToken.user_id == user.id,
            RefreshToken.revoked.is_(False),
        )
        .update({"revoked": True}, synchronize_session=False)
    )
    db.commit()


def delete_account(db: Session, user: User) -> None:
    user_id = user.id
    conversation_ids = (
        db.query(ChatConversation.id)
        .filter(ChatConversation.user_id == user_id)
    )
    goal_ids = db.query(Goal.id).filter(Goal.user_id == user_id)
    account_ids = db.query(Account.id).filter(Account.user_id == user_id)

    db.query(ChatMessage).filter(
        ChatMessage.conversation_id.in_(conversation_ids)
    ).delete(synchronize_session=False)
    db.query(ChatConversation).filter(
        ChatConversation.user_id == user_id
    ).delete(synchronize_session=False)
    db.query(ChatHistory).filter(ChatHistory.user_id == user_id).delete(
        synchronize_session=False
    )
    db.query(GoalContribution).filter(
        GoalContribution.goal_id.in_(goal_ids)
    ).delete(synchronize_session=False)
    db.query(Goal).filter(Goal.user_id == user_id).delete(
        synchronize_session=False
    )
    db.query(Budget).filter(Budget.user_id == user_id).delete(
        synchronize_session=False
    )
    db.query(Transaction).filter(
        Transaction.account_id.in_(account_ids)
    ).delete(synchronize_session=False)
    db.query(Account).filter(Account.user_id == user_id).delete(
        synchronize_session=False
    )
    db.query(Category).filter(Category.user_id == user_id).delete(
        synchronize_session=False
    )
    db.query(FinancialProfile).filter(
        FinancialProfile.user_id == user_id
    ).delete(synchronize_session=False)
    db.query(RefreshToken).filter(RefreshToken.user_id == user_id).delete(
        synchronize_session=False
    )
    db.delete(user)
    db.commit()
