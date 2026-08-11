"""
Data access for Broadcast, BroadcastTag, BroadcastImpression. Alongside
user_repository.py, this is the other half of the "one file owns all
location-based queries" boundary — the feed queries here are the ONLY
place distance is ever compared against a broadcast's radius.
"""

import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.broadcast import Broadcast, BroadcastImpression, BroadcastTag
from app.models.conversation import BlockedUser
from app.models.tag import UserFollowedTag, UserTag
from app.models.user import User


async def get_by_id(db: AsyncSession, broadcast_id: uuid.UUID | str) -> Broadcast | None:
    return await db.get(Broadcast, broadcast_id)


async def create(
    db: AsyncSession,
    *,
    sender_id: uuid.UUID,
    content: str,
    origin_point: str,
    is_global: bool,
    radius_meters: int | None,
    tag_match_mode: str,
    expires_at: datetime | None,
    tag_ids: list[int],
) -> Broadcast:
    broadcast = Broadcast(
        sender_id=sender_id,
        content=content,
        origin_point=origin_point,
        is_global=is_global,
        radius_meters=radius_meters,
        tag_match_mode=tag_match_mode,
        expires_at=expires_at,
    )
    db.add(broadcast)
    await db.flush()
    for tag_id in tag_ids:
        db.add(BroadcastTag(broadcast_id=broadcast.id, tag_id=tag_id))
    await db.flush()
    return broadcast


async def delete(db: AsyncSession, broadcast: Broadcast) -> None:
    await db.delete(broadcast)
    await db.flush()


async def for_you_feed(db: AsyncSession, user_id: uuid.UUID, limit: int, offset: int):
    """
    Ranked by shared-tag count, then distance, then recency. Tags BOOST
    ranking here, they never gate visibility — see docs/PRODUCT_BRIEF.md
    '§Why tags don't hard-filter the For You feed'. Returns
    (Broadcast, distance_m, shared_tag_count) tuples.
    """
    user_loc = select(User.location).where(User.id == user_id).scalar_subquery()

    shared_tags = (
        select(func.count(BroadcastTag.tag_id))
        .join(UserTag, UserTag.tag_id == BroadcastTag.tag_id)
        .where(BroadcastTag.broadcast_id == Broadcast.id, UserTag.user_id == user_id)
        .correlate(Broadcast)
        .scalar_subquery()
    )
    distance_m = func.ST_Distance(Broadcast.origin_point, user_loc)
    blocked_sender_ids = select(BlockedUser.blocked_id).where(BlockedUser.blocker_id == user_id)

    stmt = (
        select(Broadcast, distance_m.label("distance_m"), shared_tags.label("shared_tag_count"))
        .options(selectinload(Broadcast.sender))
        .options(selectinload(Broadcast.tags).selectinload(BroadcastTag.tag))
        .join(User, User.id == Broadcast.sender_id)
        .where(User.is_suspended.is_(False))
        .where(Broadcast.sender_id.not_in(blocked_sender_ids))
        .where(Broadcast.is_global.is_(True) | (distance_m <= Broadcast.radius_meters))
        .where((Broadcast.expires_at.is_(None)) | (Broadcast.expires_at > func.now()))
        .order_by(shared_tags.desc(), distance_m.asc(), Broadcast.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    return result.all()


async def opt_in_feed(db: AsyncSession, user_id: uuid.UUID, limit: int, offset: int):
    """Broadcasts tagged with anything the user has explicitly followed —
    the one feed where a tag acts as a hard filter, because the user opted
    into it themselves. Returns (Broadcast, distance_m) tuples."""
    user_loc = select(User.location).where(User.id == user_id).scalar_subquery()
    distance_m = func.ST_Distance(Broadcast.origin_point, user_loc)
    blocked_sender_ids = select(BlockedUser.blocked_id).where(BlockedUser.blocker_id == user_id)

    stmt = (
        select(Broadcast, distance_m.label("distance_m"))
        .options(selectinload(Broadcast.sender))
        .options(selectinload(Broadcast.tags).selectinload(BroadcastTag.tag))
        .join(User, User.id == Broadcast.sender_id)
        .join(BroadcastTag, BroadcastTag.broadcast_id == Broadcast.id)
        .join(UserFollowedTag, UserFollowedTag.tag_id == BroadcastTag.tag_id)
        .where(User.is_suspended.is_(False))
        .where(Broadcast.sender_id.not_in(blocked_sender_ids))
        .where(UserFollowedTag.user_id == user_id)
        .where(Broadcast.is_global.is_(True) | (distance_m <= Broadcast.radius_meters))
        .where((Broadcast.expires_at.is_(None)) | (Broadcast.expires_at > func.now()))
        .distinct()
        .order_by(distance_m.asc(), Broadcast.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    return result.all()


async def has_impression(db: AsyncSession, broadcast_id: uuid.UUID, viewer_id: uuid.UUID) -> bool:
    result = await db.execute(
        select(BroadcastImpression.id).where(BroadcastImpression.broadcast_id == broadcast_id, BroadcastImpression.viewer_id == viewer_id)
    )
    return result.scalar_one_or_none() is not None


async def record_impression(db: AsyncSession, broadcast_id: uuid.UUID, viewer_id: uuid.UUID) -> None:
    """Idempotent — call freely each time a broadcast is served into a feed."""
    if await has_impression(db, broadcast_id, viewer_id):
        return
    db.add(BroadcastImpression(broadcast_id=broadcast_id, viewer_id=viewer_id))
    await db.flush()
