import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.schemas import GroupCreateIn, GroupCreateOut, GroupOut
from app.services import conversation_service
from app.utils.config import settings

router = APIRouter(prefix="/groups", tags=["groups"])


@router.post("", status_code=201, response_model=GroupCreateOut)
async def create_group(
    payload: GroupCreateIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conversation, invite = await conversation_service.create_group_conversation(
        db, current_user.id, payload.name, payload.max_participants
    )
    return GroupCreateOut(
        conversation_id=conversation.id,
        invite_url=f"{settings.FRONTEND_URL}/join/{invite.token}",
    )


@router.get("", response_model=list[GroupOut])
async def list_my_groups(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await conversation_service.list_groups_for_user(db, current_user.id)


@router.post("/{conversation_id}/leave", status_code=204)
async def leave_group(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await conversation_service.leave_group(db, current_user.id, conversation_id)


@router.post("/{conversation_id}/participants/{target_user_id}/promote", status_code=204)
async def promote_participant(
    conversation_id: str,
    target_user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await conversation_service.promote_to_admin(db, current_user.id, conversation_id, target_user_id)
