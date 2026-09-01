from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.schemas import ConversationContextOut, ConversationStartIn, MessageIn, MessageOut
from app.services import conversation_service

router = APIRouter(prefix="/conversations", tags=["messages"])


@router.post("", status_code=201)
async def start_conversation(payload: ConversationStartIn, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    conversation = await conversation_service.start_conversation(db, current_user.id, payload.broadcast_id, payload.first_message)
    return {"conversation_id": str(conversation.id)}


@router.get("")
async def list_conversations(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await conversation_service.list_conversations_for_user(db, current_user.id)


@router.get("/unread-count")
async def unread_count(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await conversation_service.get_unread_count(db, current_user.id)


@router.post("/mark-seen")
async def mark_seen(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await conversation_service.mark_all_seen(db, current_user.id)
    return {"status": "ok"}


@router.get("/search")
async def search_conversations(q: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await conversation_service.search_messages_for_user(db, current_user.id, q)


@router.get("/mentions")
async def list_mentions(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await conversation_service.list_unread_mentions(db, current_user.id)


@router.post("/mentions/{notification_id}/read")
async def mark_mention_read(notification_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await conversation_service.mark_mention_read(db, current_user.id, notification_id)
    return {"status": "ok"}


@router.get("/{conversation_id}/mention-candidates")
async def mention_candidates(
    conversation_id: str,
    q: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await conversation_service.list_mention_candidates(db, current_user.id, conversation_id, q)


@router.put("/{conversation_id}/hide", status_code=204)
async def hide_conversation(conversation_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await conversation_service.hide_conversation(db, current_user.id, conversation_id)


@router.get("/{conversation_id}", response_model=ConversationContextOut)
async def get_conversation(conversation_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await conversation_service.get_conversation_context(db, current_user.id, conversation_id)


@router.get("/{conversation_id}/messages", response_model=list[MessageOut])
async def list_messages(conversation_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await conversation_service.list_messages(db, current_user.id, conversation_id)


@router.post("/{conversation_id}/messages", status_code=201, response_model=MessageOut)
async def send_message(conversation_id: str, payload: MessageIn, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await conversation_service.send_message(db, current_user.id, conversation_id, payload.body)
