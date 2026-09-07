from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.schemas import InvitePreviewOut
from app.services import conversation_service

router = APIRouter(prefix="/join", tags=["join"])


@router.get("/{token}", response_model=InvitePreviewOut)
async def preview_invite(token: str, db: AsyncSession = Depends(get_db)):
    return await conversation_service.get_invite_preview(db, token)


@router.post("/{token}")
async def join_invite(
    token: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conversation = await conversation_service.join_via_invite(db, current_user.id, token)
    return {"conversation_id": str(conversation.id)}
