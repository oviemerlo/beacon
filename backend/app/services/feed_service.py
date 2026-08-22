"""
Feed assembly. Every call here also records an impression for each
broadcast served — that's what makes conversation_service's DM-eligibility
check possible later (see docs/PRODUCT_BRIEF.md '§Why DM eligibility uses
a stored impression, not live distance'). This is a business rule, not a
data-access detail, which is why it lives here rather than being folded
silently into the repository query.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import broadcast_repository, user_repository


async def get_for_you_feed(db: AsyncSession, user_id: uuid.UUID, limit: int, offset: int):
    rows = await broadcast_repository.for_you_feed(db, user_id, limit, offset)
    for broadcast, _distance, _shared, _reply_count in rows:
        await broadcast_repository.record_impression(db, broadcast.id, user_id)
    await db.commit()
    return rows


async def get_opt_in_feed(db: AsyncSession, user_id: uuid.UUID, limit: int, offset: int):
    rows = await broadcast_repository.opt_in_feed(db, user_id, limit, offset)
    for broadcast, _distance, _reply_count in rows:
        await broadcast_repository.record_impression(db, broadcast.id, user_id)
    await db.commit()
    return rows


async def get_unread_count(db: AsyncSession, user_id: uuid.UUID) -> int:
    user = await user_repository.get_by_id(db, user_id)
    if user is None:
        return 0
    seen_after = user.last_feed_seen_at or user.created_at
    return await broadcast_repository.count_unread_for_you_roots_since(db, user_id, seen_after)


async def mark_feed_seen(db: AsyncSession, user_id: uuid.UUID) -> None:
    user = await user_repository.get_by_id(db, user_id)
    if user is None:
        return
    await user_repository.set_last_feed_seen(db, user, datetime.now(timezone.utc))
    await db.commit()
