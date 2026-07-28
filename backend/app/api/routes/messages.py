from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.schemas import ConversationStartIn, MessageIn, MessageOut
from app.services import conversation_service

router = APIRouter(prefix="/conversations", tags=["messages"])


@router.post("", status_code=201)
async def start_conversation(payload: ConversationStartIn, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    conversation = await conversation_service.start_conversation(db, current_user.id, payload.broadcast_id, payload.first_message)
    return {"conversation_id": str(conversation.id)}


@router.get("/{conversation_id}/messages", response_model=list[MessageOut])
async def list_messages(conversation_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await conversation_service.list_messages(db, current_user.id, conversation_id)


@router.post("/{conversation_id}/messages", status_code=201, response_model=MessageOut)
async def send_message(conversation_id: str, payload: MessageIn, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await conversation_service.send_message(db, current_user.id, conversation_id, payload.body)
