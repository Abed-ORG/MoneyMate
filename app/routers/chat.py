from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.chat import (
    ChatConversationCreate,
    ChatConversationListResponse,
    ChatConversationRead,
    ChatConversationUpdate,
    ChatMessagesResponse,
    ChatMessageCreate,
    ChatSendMessageResponse,
)
from app.services.chat_service import (
    ChatNotFoundError,
    ChatProviderUnavailableError,
    archive_conversation,
    create_conversation,
    get_conversation,
    conversation_to_schema,
    list_conversations,
    list_messages,
    rename_conversation,
    retry_message,
    send_message,
)


router = APIRouter()


def not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Conversation not found.",
    )


@router.post(
    "/conversations",
    response_model=ChatConversationRead,
    status_code=status.HTTP_201_CREATED,
)
def create_chat_conversation(
    payload: ChatConversationCreate | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return create_conversation(db, current_user.id, payload)


@router.get(
    "/conversations",
    response_model=ChatConversationListResponse,
)
def read_chat_conversations(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_conversations(db, current_user.id, page, page_size)


@router.get(
    "/conversations/{conversation_id}",
    response_model=ChatConversationRead,
)
def read_chat_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        conversation = get_conversation(db, current_user.id, conversation_id)
    except ChatNotFoundError:
        raise not_found()
    return conversation_to_schema(db, conversation)


@router.patch(
    "/conversations/{conversation_id}",
    response_model=ChatConversationRead,
)
def update_chat_conversation(
    conversation_id: int,
    payload: ChatConversationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return rename_conversation(
            db,
            current_user.id,
            conversation_id,
            payload,
        )
    except ChatNotFoundError:
        raise not_found()


@router.delete(
    "/conversations/{conversation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_chat_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        archive_conversation(db, current_user.id, conversation_id)
    except ChatNotFoundError:
        raise not_found()


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=ChatMessagesResponse,
)
def read_chat_messages(
    conversation_id: int,
    limit: int = Query(30, ge=1, le=100),
    before_message_id: int | None = Query(None, ge=1),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return list_messages(
            db,
            current_user.id,
            conversation_id,
            limit,
            before_message_id,
        )
    except ChatNotFoundError:
        raise not_found()


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=ChatSendMessageResponse,
)
def create_chat_message(
    conversation_id: int,
    payload: ChatMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return send_message(
            db,
            current_user.id,
            conversation_id,
            payload.question,
        )
    except ChatNotFoundError:
        raise not_found()
    except ChatProviderUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=exc.detail(),
        )


@router.post(
    "/conversations/{conversation_id}/messages/{message_id}/retry",
    response_model=ChatSendMessageResponse,
)
def retry_chat_message(
    conversation_id: int,
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return retry_message(
            db,
            current_user.id,
            conversation_id,
            message_id,
        )
    except ChatNotFoundError:
        raise not_found()
    except ChatProviderUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=exc.detail(),
        )
