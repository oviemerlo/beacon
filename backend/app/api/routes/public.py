"""Unauthenticated share endpoints — no get_current_user."""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.schemas import PublicBroadcastOut
from app.services import broadcast_service

router = APIRouter(prefix="/public", tags=["public"])


@router.get("/echoes/{broadcast_id}", response_model=PublicBroadcastOut)
async def get_public_echo(broadcast_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await broadcast_service.get_public_broadcast(db, broadcast_id)
