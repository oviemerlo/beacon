"""Broadcast creation/deletion business rules."""

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.broadcast import Broadcast
from app.repositories import broadcast_repository
from app.schemas.schemas import BroadcastCreateIn
from app.services.exceptions import ForbiddenError, NotFoundError, ValidationError


async def create_broadcast(db: AsyncSession, sender_id: uuid.UUID, payload: BroadcastCreateIn) -> Broadcast:
    if payload.reply_to_broadcast_id is not None:
        parent_broadcast = await broadcast_repository.get_by_id(db, payload.reply_to_broadcast_id)
        if parent_broadcast is None:
            raise NotFoundError("Parent broadcast not found")

    if payload.is_global:
        if payload.radius_meters is not None:
            raise ValidationError("radius_meters must be omitted when is_global is true")
        radius_meters = None
    else:
        if payload.radius_meters is None:
            raise ValidationError("radius_meters is required when is_global is false")
        if payload.radius_meters < settings.MIN_RADIUS_METERS:
            raise ValidationError(f"radius_meters must be at least {settings.MIN_RADIUS_METERS}")
        if payload.radius_meters > settings.MAX_BROADCAST_RADIUS_METERS:
            raise ValidationError(f"radius_meters cannot exceed {settings.MAX_BROADCAST_RADIUS_METERS}")
        radius_meters = payload.radius_meters

    broadcast = await broadcast_repository.create(
        db,
        sender_id=sender_id,
        content=payload.content,
        origin_point=f"SRID=4326;POINT({payload.longitude} {payload.latitude})",
        is_global=payload.is_global,
        radius_meters=radius_meters,
        tag_match_mode=payload.tag_match_mode,
        expires_at=(datetime.now(timezone.utc) + timedelta(days=payload.expires_in_days)) if payload.expires_in_days else None,
        tag_ids=payload.tag_ids,
        parent_broadcast_id=payload.reply_to_broadcast_id,
    )
    await db.commit()
    await db.refresh(broadcast)
    return broadcast


async def delete_broadcast(db: AsyncSession, current_user_id: uuid.UUID, broadcast_id: str) -> None:
    broadcast = await broadcast_repository.get_by_id(db, broadcast_id)
    if broadcast is None:
        raise NotFoundError("Broadcast not found")
    if broadcast.sender_id != current_user_id:
        raise ForbiddenError("You can only delete your own broadcasts")

    await broadcast_repository.delete(db, broadcast)
    await db.commit()


async def get_broadcast_thread(db: AsyncSession, user_id: uuid.UUID, broadcast_id: str):
    anchor = await broadcast_repository.get_by_id(db, broadcast_id)
    if anchor is None:
        raise NotFoundError("Broadcast not found")
    root_id = anchor.parent_broadcast_id or anchor.id

    parent_row = await broadcast_repository.get_visible_with_context(db, user_id, root_id)
    if parent_row is None:
        raise NotFoundError("Broadcast not found")

    replies = await broadcast_repository.list_visible_replies(db, user_id, root_id)
    return parent_row, replies
