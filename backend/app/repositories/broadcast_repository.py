"""
Data access for Broadcast, BroadcastTag, BroadcastImpression. Alongside
user_repository.py, this is the other half of the "one file owns all
location-based queries" boundary — the feed queries here are the ONLY
place distance is ever compared against a broadcast's radius.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import and_, case, func, select, union
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased, selectinload

from app.models.broadcast import Broadcast, BroadcastCourse, BroadcastImpression, BroadcastTag, HiddenBroadcast
from app.models.conversation import BlockedUser
from app.models.school import UserCourseEnrollment
from app.models.tag import Tag, UserFollowedTag, UserTag
from app.models.user import User
from app.services.regions import COUNTRY_NAME_TO_REGION


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


def _latest_visible_reply_at_subquery(user_id: uuid.UUID):
    reply_broadcast = aliased(Broadcast)
    reply_sender = aliased(User)
    blocked_sender_ids = select(BlockedUser.blocked_id).where(BlockedUser.blocker_id == user_id)
    hidden_ids = _hidden_broadcast_ids(user_id)
    return (
        select(func.max(reply_broadcast.created_at))
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


def _last_activity_at(user_id: uuid.UUID):
    return func.greatest(
        Broadcast.created_at,
        func.coalesce(_latest_visible_reply_at_subquery(user_id), Broadcast.created_at),
    )


def _country_to_region_case(label_column):
    return case(
        *((country, region) for country, region in COUNTRY_NAME_TO_REGION.items()),
        value=label_column,
    )


def _audience_overlap_count(match_ids):
    return (
        select(func.count(BroadcastTag.tag_id))
        .where(
            BroadcastTag.broadcast_id == Broadcast.id,
            BroadcastTag.tag_id.in_(select(match_ids.c.tag_id)),
        )
        .correlate(Broadcast)
        .scalar_subquery()
    )


def _viewer_tag_labels(user_id: uuid.UUID, tag_type: str):
    owned = (
        select(Tag.label.label("label"))
        .select_from(UserTag)
        .join(Tag, Tag.id == UserTag.tag_id)
        .where(UserTag.user_id == user_id, Tag.tag_type == tag_type)
    )
    followed = (
        select(Tag.label.label("label"))
        .select_from(UserFollowedTag)
        .join(Tag, Tag.id == UserFollowedTag.tag_id)
        .where(UserFollowedTag.user_id == user_id, Tag.tag_type == tag_type)
    )
    return union(owned, followed).subquery()


def _implied_region_tag_ids(user_id: uuid.UUID):
    """Region tags covering the viewer's nationality countries (e.g. Nigeria → Sub-Saharan Africa)."""
    nationality_labels = _viewer_tag_labels(user_id, "nationality")
    mapped_regions = (
        select(_country_to_region_case(nationality_labels.c.label).label("region_label"))
        .select_from(nationality_labels)
        .subquery()
    )
    region_tag = aliased(Tag)
    return select(region_tag.id.label("tag_id")).where(
        region_tag.tag_type == "region",
        region_tag.label.in_(select(mapped_regions.c.region_label)),
    )


def _implied_country_tag_ids(user_id: uuid.UUID):
    """Nationality tags inside the viewer's followed regions (e.g. Sub-Saharan Africa → Nigeria)."""
    region_labels = _viewer_tag_labels(user_id, "region")
    nationality_tag = aliased(Tag)
    return select(nationality_tag.id.label("tag_id")).where(
        nationality_tag.tag_type == "nationality",
        _country_to_region_case(nationality_tag.label).in_(select(region_labels.c.label)),
    )


def _viewer_match_tag_ids(user_id: uuid.UUID):
    owned = select(UserTag.tag_id.label("tag_id")).where(UserTag.user_id == user_id)
    followed = select(UserFollowedTag.tag_id.label("tag_id")).where(UserFollowedTag.user_id == user_id)
    return union(
        owned,
        followed,
        _implied_region_tag_ids(user_id),
        _implied_country_tag_ids(user_id),
    ).subquery()


def _shared_tag_count_subquery(user_id: uuid.UUID):
    return _audience_overlap_count(_viewer_match_tag_ids(user_id))


def _broadcast_ids_for_audience_tags(tag_ids: list[int]):
    """Direct tag hits plus the country↔region audience expansion."""
    direct = select(BroadcastTag.broadcast_id.label("broadcast_id")).where(BroadcastTag.tag_id.in_(tag_ids))
    selected = select(Tag.tag_type, Tag.label).where(Tag.id.in_(tag_ids)).subquery()
    implied_region_labels = select(_country_to_region_case(selected.c.label)).where(selected.c.tag_type == "nationality")
    via_region = (
        select(BroadcastTag.broadcast_id.label("broadcast_id"))
        .join(Tag, Tag.id == BroadcastTag.tag_id)
        .where(Tag.tag_type == "region", Tag.label.in_(implied_region_labels))
    )
    selected_regions = select(selected.c.label).where(selected.c.tag_type == "region")
    via_country = (
        select(BroadcastTag.broadcast_id.label("broadcast_id"))
        .join(Tag, Tag.id == BroadcastTag.tag_id)
        .where(
            Tag.tag_type == "nationality",
            _country_to_region_case(Tag.label).in_(selected_regions),
        )
    )
    return union(direct, via_region, via_country)


def selected_audience_matches(echo_id_col, tag_ids: list[int]):
    if not tag_ids:
        return None
    return echo_id_col.in_(_broadcast_ids_for_audience_tags(tag_ids))


def selected_course_matches(echo_id_col, course_codes: list[str]):
    """AND-filter: the echo must target every selected course tag."""
    if not course_codes:
        return None
    parts = []
    for code in course_codes:
        in_courses = (
            select(BroadcastCourse.broadcast_id)
            .where(BroadcastCourse.broadcast_id == echo_id_col, BroadcastCourse.course_code == code)
            .exists()
        )
        on_echo = select(Broadcast.id).where(Broadcast.id == echo_id_col, Broadcast.course_code == code).exists()
        parts.append(in_courses | on_echo)
    return and_(*parts)


def apply_audience_filters(stmt, echo_id_col, tag_ids: list[int] | None, course_codes: list[str] | None):
    tag_clause = selected_audience_matches(echo_id_col, tag_ids or [])
    if tag_clause is not None:
        stmt = stmt.where(tag_clause)
    course_clause = selected_course_matches(echo_id_col, course_codes or [])
    if course_clause is not None:
        stmt = stmt.where(course_clause)
    return stmt


def _visibility_clause(user_id: uuid.UUID):
    viewer_profile_tag_ids = select(UserTag.tag_id).where(UserTag.user_id == user_id).subquery()
    viewer_location_tag_ids = _viewer_match_tag_ids(user_id)

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
    region_gate = (~has_tag_type("region")) | (matching_tag_count_for_type("region", viewer_location_tag_ids) > 0)
    school_gate = (~has_tag_type("school")) | (matching_tag_count_for_type("school", viewer_profile_tag_ids) > 0)
    targeted_course_count = (
        select(func.count())
        .select_from(BroadcastCourse)
        .where(BroadcastCourse.broadcast_id == Broadcast.id)
        .correlate(Broadcast)
        .scalar_subquery()
    )
    matched_course_count = (
        select(func.count())
        .select_from(BroadcastCourse)
        .join(
            UserCourseEnrollment,
            (UserCourseEnrollment.user_id == user_id)
            & (UserCourseEnrollment.school_id == Broadcast.school_id)
            & (UserCourseEnrollment.course_code == BroadcastCourse.course_code),
        )
        .where(BroadcastCourse.broadcast_id == Broadcast.id)
        .correlate(Broadcast)
        .scalar_subquery()
    )
    legacy_course_match = (
        Broadcast.course_code.is_not(None)
        & (targeted_course_count == 0)
        & (
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
    course_gate = (
        ((targeted_course_count == 0) & Broadcast.course_code.is_(None))
        | ((targeted_course_count > 0) & (matched_course_count == targeted_course_count))
        | legacy_course_match
    )

    hobby_gate = (~has_tag_type("hobby")) | (matching_tag_count_for_type("hobby", viewer_location_tag_ids) > 0)
    has_course_target = (targeted_course_count > 0) | Broadcast.course_code.is_not(None)
    uses_school_or_course = has_tag_type("school") | has_course_target

    broadcast_tag_count = (
        select(func.count(BroadcastTag.tag_id))
        .where(BroadcastTag.broadcast_id == Broadcast.id)
        .correlate(Broadcast)
        .scalar_subquery()
    )
    matching_tag_count = _audience_overlap_count(viewer_location_tag_ids)
    any_mode_match = (Broadcast.tag_match_mode != "all") & (matching_tag_count > 0)
    all_mode_match = (
        (Broadcast.tag_match_mode == "all")
        & (broadcast_tag_count > 0)
        & (matching_tag_count == broadcast_tag_count)
    )
    # Untagged in-feed replies stay visible so existing threads don't disappear.
    untagged_reply = Broadcast.parent_broadcast_id.is_not(None) & (broadcast_tag_count == 0)
    has_location_audience_tag = has_tag_type("nationality") | has_tag_type("region") | has_tag_type("hobby")
    tag_gate = untagged_reply | (~has_location_audience_tag) | any_mode_match | all_mode_match

    # School or course targeting ANDs every selected dimension (country, region, school, hobby, course).
    type_and_gates = nationality_gate & region_gate & school_gate & hobby_gate & course_gate
    legacy_gates = nationality_gate & region_gate & school_gate & course_gate & tag_gate
    return (Broadcast.sender_id == user_id) | ((uses_school_or_course & type_and_gates) | (~uses_school_or_course & legacy_gates))


def _blocked_sender_ids(user_id: uuid.UUID):
    return select(BlockedUser.blocked_id).where(BlockedUser.blocker_id == user_id)


def _distance_m(user_id: uuid.UUID):
    user_loc = select(User.location).where(User.id == user_id).scalar_subquery()
    return func.ST_Distance(Broadcast.origin_point, user_loc)


def _echo_load_options():
    return (
        selectinload(Broadcast.sender),
        selectinload(Broadcast.tags).selectinload(BroadcastTag.tag),
    )


def _still_live():
    return (Broadcast.expires_at.is_(None)) | (Broadcast.expires_at > func.now())


def _in_reach(user_id: uuid.UUID, distance_m):
    """Radius is for delivering to other people. The sender always sees their own echo."""
    return (
        (Broadcast.sender_id == user_id)
        | Broadcast.is_global.is_(True)
        | (distance_m <= Broadcast.radius_meters)
    )


def _echo_viewer_filters(user_id: uuid.UUID, distance_m=None, *, in_reach: bool, visibility: bool):
    filters = [
        User.is_suspended.is_(False),
        Broadcast.sender_id.not_in(_blocked_sender_ids(user_id)),
        _not_deleted(),
        Broadcast.id.not_in(_hidden_broadcast_ids(user_id)),
        _still_live(),
    ]
    if in_reach:
        filters.append(_in_reach(user_id, distance_m))
    if visibility:
        filters.append(_visibility_clause(user_id))
    return tuple(filters)


def _echo_context_select(user_id: uuid.UUID, *, in_reach: bool, visibility: bool):
    distance_m = _distance_m(user_id)
    shared_tags = _shared_tag_count_subquery(user_id)
    reply_count = _reply_count_subquery_for_viewer(user_id)
    stmt = (
        select(Broadcast, distance_m.label("distance_m"), shared_tags.label("shared_tag_count"), reply_count.label("reply_count"))
        .options(*_echo_load_options())
        .join(User, User.id == Broadcast.sender_id)
        .where(*_echo_viewer_filters(user_id, distance_m, in_reach=in_reach, visibility=visibility))
    )
    return stmt, distance_m, shared_tags


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
    course_codes: list[str],
    include_sender_avatar: bool = False,
    moderation_status: str = "pending",
    moderation_labels: str | None = None,
) -> Broadcast:
    broadcast = Broadcast(
        sender_id=sender_id,
        parent_broadcast_id=parent_broadcast_id,
        content=content,
        origin_point=origin_point,
        is_global=is_global,
        radius_meters=radius_meters,
        school_id=school_id,
        course_code=course_codes[0] if course_codes else None,
        tag_match_mode=tag_match_mode,
        expires_at=expires_at,
        include_sender_avatar=include_sender_avatar,
        moderation_status=moderation_status,
        moderation_labels=moderation_labels,
    )
    db.add(broadcast)
    await db.flush()
    for tag_id in tag_ids:
        db.add(BroadcastTag(broadcast_id=broadcast.id, tag_id=tag_id))
    for course_code in course_codes:
        db.add(BroadcastCourse(broadcast_id=broadcast.id, course_code=course_code))
    await db.flush()
    return broadcast


async def list_course_codes(db: AsyncSession, broadcast_id: uuid.UUID) -> list[str]:
    result = await db.execute(
        select(BroadcastCourse.course_code).where(BroadcastCourse.broadcast_id == broadcast_id).order_by(BroadcastCourse.course_code)
    )
    return [row[0] for row in result.all()]


async def list_course_codes_by_broadcast_ids(db: AsyncSession, broadcast_ids: list[uuid.UUID]) -> dict[uuid.UUID, list[str]]:
    if not broadcast_ids:
        return {}
    result = await db.execute(
        select(BroadcastCourse.broadcast_id, BroadcastCourse.course_code)
        .where(BroadcastCourse.broadcast_id.in_(broadcast_ids))
        .order_by(BroadcastCourse.course_code)
    )
    by_id: dict[uuid.UUID, list[str]] = {broadcast_id: [] for broadcast_id in broadcast_ids}
    for broadcast_id, course_code in result.all():
        by_id.setdefault(broadcast_id, []).append(course_code)
    return by_id


async def soft_delete(db: AsyncSession, broadcast: Broadcast) -> None:
    if broadcast.deleted_at is None:
        broadcast.deleted_at = datetime.now(timezone.utc)
        await db.flush()


async def hide_for_user(db: AsyncSession, user_id: uuid.UUID, broadcast_id: uuid.UUID) -> None:
    existing = await db.get(HiddenBroadcast, (user_id, broadcast_id))
    if existing is None:
        db.add(HiddenBroadcast(user_id=user_id, broadcast_id=broadcast_id))
        await db.flush()


async def for_you_feed(
    db: AsyncSession,
    user_id: uuid.UUID,
    limit: int,
    offset: int,
    tag_ids: list[int] | None = None,
    course_codes: list[str] | None = None,
):
    """
    Ranked by last activity (echo or latest visible reply), then shared-tag count, then distance.
    Nationality/region tags also gate visibility for targeted posts.
    Returns
    (Broadcast, distance_m, shared_tag_count) tuples.
    """
    stmt, distance_m, shared_tags = _echo_context_select(user_id, in_reach=True, visibility=True)
    stmt = stmt.where(Broadcast.parent_broadcast_id.is_(None))
    stmt = apply_audience_filters(stmt, Broadcast.id, tag_ids, course_codes)
    stmt = stmt.order_by(_last_activity_at(user_id).desc(), shared_tags.desc(), distance_m.asc()).limit(limit).offset(offset)
    result = await db.execute(stmt)
    return result.all()


async def count_unread_for_you_roots_since(db: AsyncSession, user_id: uuid.UUID, seen_after: datetime) -> int:
    distance_m = _distance_m(user_id)
    stmt = (
        select(func.count(Broadcast.id))
        .join(User, User.id == Broadcast.sender_id)
        .where(Broadcast.parent_broadcast_id.is_(None))
        .where(*_echo_viewer_filters(user_id, distance_m, in_reach=True, visibility=True))
        .where(_last_activity_at(user_id) > seen_after)
    )
    result = await db.execute(stmt)
    return int(result.scalar_one() or 0)


async def opt_in_feed(db: AsyncSession, user_id: uuid.UUID, limit: int, offset: int):
    """Broadcasts tagged with anything the user has explicitly followed —
    the one feed where a tag acts as a hard filter, because the user opted
    into it themselves. Returns (Broadcast, distance_m, reply_count) tuples."""
    distance_m = _distance_m(user_id)
    reply_count = _reply_count_subquery_for_viewer(user_id)
    match_ids = _viewer_match_tag_ids(user_id)
    matching_ids = (
        select(Broadcast.id)
        .join(User, User.id == Broadcast.sender_id)
        .join(BroadcastTag, BroadcastTag.broadcast_id == Broadcast.id)
        .where(Broadcast.parent_broadcast_id.is_(None))
        .where(*_echo_viewer_filters(user_id, distance_m, in_reach=True, visibility=False))
        .where(BroadcastTag.tag_id.in_(select(match_ids.c.tag_id)))
        .distinct()
    )
    stmt = (
        select(Broadcast, distance_m.label("distance_m"), reply_count.label("reply_count"))
        .options(*_echo_load_options())
        .join(User, User.id == Broadcast.sender_id)
        .where(Broadcast.id.in_(matching_ids))
        .order_by(distance_m.asc(), _last_activity_at(user_id).desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    return result.all()


async def latest_visible_replies_by_parent(
    db: AsyncSession, user_id: uuid.UUID, parent_ids: list[uuid.UUID]
) -> dict[uuid.UUID, Broadcast]:
    if not parent_ids:
        return {}
    blocked_sender_ids = select(BlockedUser.blocked_id).where(BlockedUser.blocker_id == user_id)
    hidden_ids = _hidden_broadcast_ids(user_id)
    stmt = (
        select(Broadcast)
        .options(selectinload(Broadcast.sender))
        .join(User, User.id == Broadcast.sender_id)
        .where(Broadcast.parent_broadcast_id.in_(parent_ids))
        .where(User.is_suspended.is_(False))
        .where(Broadcast.sender_id.not_in(blocked_sender_ids))
        .where(_not_deleted())
        .where(Broadcast.id.not_in(hidden_ids))
        .where((Broadcast.expires_at.is_(None)) | (Broadcast.expires_at > func.now()))
        .distinct(Broadcast.parent_broadcast_id)
        .order_by(Broadcast.parent_broadcast_id, Broadcast.created_at.desc())
    )
    rows = (await db.execute(stmt)).scalars().all()
    return {row.parent_broadcast_id: row for row in rows if row.parent_broadcast_id is not None}


async def has_impression(db: AsyncSession, broadcast_id: uuid.UUID, viewer_id: uuid.UUID) -> bool:
    result = await db.execute(
        select(BroadcastImpression.id)
        .where(BroadcastImpression.broadcast_id == broadcast_id, BroadcastImpression.viewer_id == viewer_id)
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


async def record_impression(db: AsyncSession, broadcast_id: uuid.UUID, viewer_id: uuid.UUID) -> None:
    """Idempotent — call freely each time a broadcast is served into a feed."""
    await db.execute(
        pg_insert(BroadcastImpression)
        .values(id=uuid.uuid4(), broadcast_id=broadcast_id, viewer_id=viewer_id)
        .on_conflict_do_nothing(constraint="uq_broadcast_impressions_broadcast_viewer")
    )


async def get_visible_with_context(db: AsyncSession, user_id: uuid.UUID, broadcast_id: uuid.UUID | str):
    stmt, _distance_m, _shared_tags = _echo_context_select(user_id, in_reach=True, visibility=True)
    result = await db.execute(stmt.where(Broadcast.id == broadcast_id))
    return result.first()


async def list_visible_replies(db: AsyncSession, user_id: uuid.UUID, parent_broadcast_id: uuid.UUID | str):
    stmt, _distance_m, _shared_tags = _echo_context_select(user_id, in_reach=False, visibility=True)
    result = await db.execute(
        stmt.where(Broadcast.parent_broadcast_id == parent_broadcast_id).order_by(Broadcast.created_at.desc())
    )
    return result.all()
