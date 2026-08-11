import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.services import block_service

router = APIRouter(prefix="/blocks", tags=["blocks"])


@router.put("/{blocked_user_id}")
async def block_user(
    blocked_user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await block_service.block_user(db, current_user.id, blocked_user_id)
    return {"status": "ok"}


@router.delete("/{blocked_user_id}")
async def unblock_user(
    blocked_user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await block_service.unblock_user(db, current_user.id, blocked_user_id)
    return {"status": "ok"}


@router.get("")
async def list_my_blocks(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    blocked_user_ids = await block_service.list_blocked_user_ids(db, current_user.id)
    return {"blocked_user_ids": blocked_user_ids}
