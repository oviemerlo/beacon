"""
Data access for Broadcast, BroadcastTag, BroadcastImpression. Alongside
user_repository.py, this is the other half of the "one file owns all
location-based queries" boundary — the feed queries here are the ONLY
place distance is ever compared against a broadcast's radius.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased, selectinload

from app.models.broadcast import Broadcast, BroadcastImpression, BroadcastTag, HiddenBroadcast
from app.models.conversation import BlockedUser
from app.models.school import UserCourseEnrollment
from app.models.tag import Tag, UserFollowedTag, UserTag
from app.models.user import User


def _hidden_broadcast_ids(user_id: uuid.UUID):
    return select(HiddenBroadcast.broadcast_id).where(HiddenBroadcast.user_id == user_id)


def _not_deleted(alias=Broadcast):
    return alias.deleted_at.is_(None)


def _reply_count_subquery_for_viewer(user_id: uuid.UUID):
    reply_broadcast = aliased(Broadcast)
    reply_sender = aliased(User)
    blocked_sender_ids = select(BlockedUser.blocked_id).where(BlockedUser.blocker_id == user_id)
    hidden_ids = _hidden_broadcast_ids(user_id)
    return (
        select(func.count(reply_broadcast.id))
        .join(reply_sender, reply_sender.id == reply_broadcast.sender_id)
        .where(reply_broadcast.parent_broadcast_id == Broadcast.id)
        .where(reply_sender.is_suspended.is_(False))
        .where(reply_broadcast.sender_id.not_in(blocked_sender_ids))
        .where(_not_deleted(reply_broadcast))
        .where(reply_broadcast.id.not_in(hidden_ids))
        .where((reply_broadcast.expires_at.is_(None)) | (reply_broadcast.expires_at > func.now()))
        .correlate(Broadcast)
        .scalar_subquery()
    )


def _visibility_clause(user_id: uuid.UUID):
    viewer_profile_tag_ids = select(UserTag.tag_id).where(UserTag.user_id == user_id).subquery()
    viewer_location_tag_ids = (
        select(UserTag.tag_id)
        .where(UserTag.user_id == user_id)
        .union(select(UserFollowedTag.tag_id).where(UserFollowedTag.user_id == user_id))
        .subquery()
    )

    def has_tag_type(tag_type: str):
        return (
            select(BroadcastTag.tag_id)
            .join(Tag, Tag.id == BroadcastTag.tag_id)
            .where(
                BroadcastTag.broadcast_id == Broadcast.id,
                Tag.tag_type == tag_type,
            )
            .correlate(Broadcast)
            .exists()
        )

    def matching_tag_count_for_type(tag_type: str, viewer_tag_ids_subquery):
        return (
            select(func.count(BroadcastTag.tag_id))
            .join(Tag, Tag.id == BroadcastTag.tag_id)
            .where(
                BroadcastTag.broadcast_id == Broadcast.id,
                BroadcastTag.tag_id.in_(select(viewer_tag_ids_subquery.c.tag_id)),
                Tag.tag_type == tag_type,
            )
            .correlate(Broadcast)
            .scalar_subquery()
        )

    nationality_gate = (~has_tag_type("nationality")) | (matching_tag_count_for_type("nationality", viewer_location_tag_ids) > 0)
    continent_gate = (~has_tag_type("continent")) | (matching_tag_count_for_type("continent", viewer_location_tag_ids) > 0)
    school_gate = (~has_tag_type("school")) | (matching_tag_count_for_type("school", viewer_profile_tag_ids) > 0)
    course_gate = (
        Broadcast.course_code.is_(None)
        | (
            select(UserCourseEnrollment.user_id)
            .where(
                UserCourseEnrollment.user_id == user_id,
                UserCourseEnrollment.school_id == Broadcast.school_id,
                UserCourseEnrollment.course_code == Broadcast.course_code,
            )
            .correlate(Broadcast)
            .exists()
        )
    )

    broadcast_tag_count = (
        select(func.count(BroadcastTag.tag_id))
        .where(BroadcastTag.broadcast_id == Broadcast.id)
        .correlate(Broadcast)
        .scalar_subquery()
    )
    matching_tag_count = (
        select(func.count(BroadcastTag.tag_id))
        .where(
            BroadcastTag.broadcast_id == Broadcast.id,
            BroadcastTag.tag_id.in_(select(viewer_location_tag_ids.c.tag_id)),
        )
        .correlate(Broadcast)
        .scalar_subquery()
    )
    any_mode_match = (Broadcast.tag_match_mode != "all") & (matching_tag_count > 0)
    all_mode_match = (
        (Broadcast.tag_match_mode == "all")
        & (broadcast_tag_count > 0)
        & (matching_tag_count == broadcast_tag_count)
    )
    # Untagged in-feed replies stay visible so existing threads don't disappear.
    untagged_reply = Broadcast.parent_broadcast_id.is_not(None) & (broadcast_tag_count == 0)
    tag_gate = untagged_reply | any_mode_match | all_mode_match

    return (Broadcast.sender_id == user_id) | (nationality_gate & continent_gate & school_gate & course_gate & tag_gate)


def _in_reach(user_id: uuid.UUID, distance_m):
    """Radius is for delivering to other people. The sender always sees their own echo."""
    return (
        (Broadcast.sender_id == user_id)
        | Broadcast.is_global.is_(True)
        | (distance_m <= Broadcast.radius_meters)
    )


async def get_by_id(db: AsyncSession, broadcast_id: uuid.UUID | str) -> Broadcast | None:
    return await db.get(Broadcast, broadcast_id)


async def list_tag_ids(db: AsyncSession, broadcast_id: uuid.UUID) -> list[int]:
    result = await db.execute(select(BroadcastTag.tag_id).where(BroadcastTag.broadcast_id == broadcast_id))
    return [row[0] for row in result.all()]


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
    parent_broadcast_id: uuid.UUID | None,
    school_id: int | None,
    course_code: str | None,
) -> Broadcast:
    broadcast = Broadcast(
        sender_id=sender_id,
        parent_broadcast_id=parent_broadcast_id,
        content=content,
        origin_point=origin_point,
        is_global=is_global,
        radius_meters=radius_meters,
        school_id=school_id,
        course_code=course_code,
        tag_match_mode=tag_match_mode,
        expires_at=expires_at,
    )
    db.add(broadcast)
    await db.flush()
    for tag_id in tag_ids:
        db.add(BroadcastTag(broadcast_id=broadcast.id, tag_id=tag_id))
    await db.flush()
    return broadcast


async def soft_delete(db: AsyncSession, broadcast: Broadcast) -> None:
    if broadcast.deleted_at is None:
        broadcast.deleted_at = datetime.now(timezone.utc)
        await db.flush()


async def hide_for_user(db: AsyncSession, user_id: uuid.UUID, broadcast_id: uuid.UUID) -> None:
    existing = await db.get(HiddenBroadcast, (user_id, broadcast_id))
    if existing is None:
        db.add(HiddenBroadcast(user_id=user_id, broadcast_id=broadcast_id))
        await db.flush()


async def for_you_feed(db: AsyncSession, user_id: uuid.UUID, limit: int, offset: int):
    """
    Ranked by recency first, then shared-tag count, then distance.
    Nationality/continent tags also gate visibility for targeted posts.
    Returns
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
    visibility_clause = _visibility_clause(user_id)

    reply_count = _reply_count_subquery_for_viewer(user_id)

    stmt = (
        select(Broadcast, distance_m.label("distance_m"), shared_tags.label("shared_tag_count"), reply_count.label("reply_count"))
        .options(selectinload(Broadcast.sender))
        .options(selectinload(Broadcast.tags).selectinload(BroadcastTag.tag))
        .join(User, User.id == Broadcast.sender_id)
        .where(Broadcast.parent_broadcast_id.is_(None))
        .where(User.is_suspended.is_(False))
        .where(Broadcast.sender_id.not_in(blocked_sender_ids))
        .where(_not_deleted())
        .where(Broadcast.id.not_in(_hidden_broadcast_ids(user_id)))
        .where(_in_reach(user_id, distance_m))
        .where((Broadcast.expires_at.is_(None)) | (Broadcast.expires_at > func.now()))
        .where(visibility_clause)
        .order_by(Broadcast.created_at.desc(), shared_tags.desc(), distance_m.asc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    return result.all()


async def count_unread_for_you_roots_since(db: AsyncSession, user_id: uuid.UUID, seen_after: datetime) -> int:
    user_loc = select(User.location).where(User.id == user_id).scalar_subquery()
    distance_m = func.ST_Distance(Broadcast.origin_point, user_loc)
    blocked_sender_ids = select(BlockedUser.blocked_id).where(BlockedUser.blocker_id == user_id)
    visibility_clause = _visibility_clause(user_id)

    stmt = (
        select(func.count(Broadcast.id))
        .join(User, User.id == Broadcast.sender_id)
        .where(Broadcast.parent_broadcast_id.is_(None))
        .where(User.is_suspended.is_(False))
        .where(Broadcast.sender_id.not_in(blocked_sender_ids))
        .where(_not_deleted())
        .where(Broadcast.id.not_in(_hidden_broadcast_ids(user_id)))
        .where(_in_reach(user_id, distance_m))
        .where((Broadcast.expires_at.is_(None)) | (Broadcast.expires_at > func.now()))
        .where(visibility_clause)
        .where(Broadcast.created_at > seen_after)
    )
    result = await db.execute(stmt)
    return int(result.scalar_one() or 0)


async def opt_in_feed(db: AsyncSession, user_id: uuid.UUID, limit: int, offset: int):
    """Broadcasts tagged with anything the user has explicitly followed —
    the one feed where a tag acts as a hard filter, because the user opted
    into it themselves. Returns (Broadcast, distance_m) tuples."""
    user_loc = select(User.location).where(User.id == user_id).scalar_subquery()
    distance_m = func.ST_Distance(Broadcast.origin_point, user_loc)
    blocked_sender_ids = select(BlockedUser.blocked_id).where(BlockedUser.blocker_id == user_id)

    reply_count = _reply_count_subquery_for_viewer(user_id)

    stmt = (
        select(Broadcast, distance_m.label("distance_m"), reply_count.label("reply_count"))
        .options(selectinload(Broadcast.sender))
        .options(selectinload(Broadcast.tags).selectinload(BroadcastTag.tag))
        .join(User, User.id == Broadcast.sender_id)
        .where(Broadcast.parent_broadcast_id.is_(None))
        .join(BroadcastTag, BroadcastTag.broadcast_id == Broadcast.id)
        .join(UserFollowedTag, UserFollowedTag.tag_id == BroadcastTag.tag_id)
        .where(User.is_suspended.is_(False))
        .where(Broadcast.sender_id.not_in(blocked_sender_ids))
        .where(_not_deleted())
        .where(Broadcast.id.not_in(_hidden_broadcast_ids(user_id)))
        .where(UserFollowedTag.user_id == user_id)
        .where(_in_reach(user_id, distance_m))
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


async def get_visible_with_context(db: AsyncSession, user_id: uuid.UUID, broadcast_id: uuid.UUID | str):
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
    visibility_clause = _visibility_clause(user_id)
    reply_count = _reply_count_subquery_for_viewer(user_id)

    stmt = (
        select(Broadcast, distance_m.label("distance_m"), shared_tags.label("shared_tag_count"), reply_count.label("reply_count"))
        .options(selectinload(Broadcast.sender))
        .options(selectinload(Broadcast.tags).selectinload(BroadcastTag.tag))
        .join(User, User.id == Broadcast.sender_id)
        .where(Broadcast.id == broadcast_id)
        .where(User.is_suspended.is_(False))
        .where(Broadcast.sender_id.not_in(blocked_sender_ids))
        .where(_not_deleted())
        .where(Broadcast.id.not_in(_hidden_broadcast_ids(user_id)))
        .where(_in_reach(user_id, distance_m))
        .where((Broadcast.expires_at.is_(None)) | (Broadcast.expires_at > func.now()))
        .where(visibility_clause)
    )
    result = await db.execute(stmt)
    return result.first()


async def list_visible_replies(db: AsyncSession, user_id: uuid.UUID, parent_broadcast_id: uuid.UUID | str):
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
    reply_count = _reply_count_subquery_for_viewer(user_id)

    stmt = (
        select(Broadcast, distance_m.label("distance_m"), shared_tags.label("shared_tag_count"), reply_count.label("reply_count"))
        .options(selectinload(Broadcast.sender))
        .options(selectinload(Broadcast.tags).selectinload(BroadcastTag.tag))
        .join(User, User.id == Broadcast.sender_id)
        .where(Broadcast.parent_broadcast_id == parent_broadcast_id)
        .where(User.is_suspended.is_(False))
        .where(Broadcast.sender_id.not_in(blocked_sender_ids))
        .where(_not_deleted())
        .where(Broadcast.id.not_in(_hidden_broadcast_ids(user_id)))
        .where((Broadcast.expires_at.is_(None)) | (Broadcast.expires_at > func.now()))
        .order_by(Broadcast.created_at.desc())
    )
    result = await db.execute(stmt)
    return result.all()
