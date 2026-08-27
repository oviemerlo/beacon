"""Broadcast creation/deletion business rules."""

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.config import settings
from app.models.broadcast import Broadcast
from app.repositories import broadcast_repository, school_repository, tag_repository, user_repository
from app.schemas.schemas import BroadcastCreateIn
from app.services.broadcast_tags import serialize_echo_rows
from app.services.exceptions import ForbiddenError, NotFoundError, ValidationError
from app.services.school_service import is_currently_verified, prepare_course_tag, school_tag_matches
from app.services.user_service import REGION_TAGS_LOCKED_MESSAGE, can_follow_region_tags, can_use_regional_reach


async def create_broadcast(db: AsyncSession, sender_id: uuid.UUID, payload: BroadcastCreateIn) -> Broadcast:
    tag_ids = list(payload.tag_ids)
    is_global = payload.is_global
    radius_meters = payload.radius_meters
    tag_match_mode = payload.tag_match_mode
    inherited_school_id: int | None = None
    inherited_course_code: str | None = None
    if payload.reply_to_broadcast_id is not None:
        parent_broadcast = await broadcast_repository.get_by_id(db, payload.reply_to_broadcast_id)
        if parent_broadcast is None or parent_broadcast.deleted_at is not None:
            raise NotFoundError("Parent broadcast not found")
        if not tag_ids:
            tag_ids = await broadcast_repository.list_tag_ids(db, parent_broadcast.id)
        # Stay in the same delivery envelope as the Echo being answered.
        is_global = parent_broadcast.is_global
        radius_meters = parent_broadcast.radius_meters
        tag_match_mode = parent_broadcast.tag_match_mode
        inherited_school_id = parent_broadcast.school_id
        inherited_course_code = parent_broadcast.course_code
    elif not tag_ids:
        raise ValidationError("At least one tag is required")

    if is_global:
        if payload.reply_to_broadcast_id is None and payload.radius_meters is not None:
            raise ValidationError("radius_meters must be omitted when is_global is true")
        radius_meters = None
    else:
        if radius_meters is None:
            raise ValidationError("radius_meters is required when is_global is false")
        if radius_meters < settings.MIN_RADIUS_METERS:
            raise ValidationError(f"radius_meters must be at least {settings.MIN_RADIUS_METERS}")
        if radius_meters > settings.MAX_BROADCAST_RADIUS_METERS:
            raise ValidationError(f"radius_meters cannot exceed {settings.MAX_BROADCAST_RADIUS_METERS}")
        if payload.reply_to_broadcast_id is None and radius_meters > settings.LOCAL_MAX_RADIUS_METERS:
            sender = await user_repository.get_by_id(db, sender_id)
            if sender is None or not can_use_regional_reach(sender):
                raise ValidationError(
                    "Regional reach is available after verification. Free accounts can send Local echoes."
                )

    if payload.reply_to_broadcast_id is None and tag_ids:
        selected_targeting_tags = await tag_repository.get_by_ids(db, tag_ids)
        if any(tag.tag_type == "region" for tag in selected_targeting_tags):
            sender = await user_repository.get_by_id(db, sender_id)
            if sender is None or not can_follow_region_tags(sender):
                raise ValidationError(REGION_TAGS_LOCKED_MESSAGE)

    course_code: str | None = inherited_course_code
    school_id: int | None = inherited_school_id
    if payload.course_code is not None and payload.reply_to_broadcast_id is None:
        verification = await school_repository.get_verification(db, sender_id)
        if verification is None or not is_currently_verified(verification):
            raise ValidationError("Verify your school before targeting a course")

        sender_school = await school_repository.get_by_id(db, verification.school_id)
        if sender_school is None:
            raise NotFoundError("School not found")

        selected_tags = await tag_repository.get_by_ids(db, payload.tag_ids)
        if not any(school_tag_matches(tag, sender_school) for tag in selected_tags):
            raise ValidationError("Course targeting requires your verified school tag")

        course_code = prepare_course_tag(payload.course_code)
        school_id = verification.school_id

    broadcast = await broadcast_repository.create(
        db,
        sender_id=sender_id,
        content=payload.content,
        origin_point=f"SRID=4326;POINT({payload.longitude} {payload.latitude})",
        is_global=is_global,
        radius_meters=radius_meters,
        tag_match_mode=tag_match_mode,
        expires_at=(datetime.now(timezone.utc) + timedelta(days=payload.expires_in_days)) if payload.expires_in_days else None,
        tag_ids=tag_ids,
        parent_broadcast_id=payload.reply_to_broadcast_id,
        school_id=school_id,
        course_code=course_code,
    )
    await db.commit()
    await db.refresh(broadcast)
    return broadcast


async def delete_broadcast(db: AsyncSession, current_user_id: uuid.UUID, broadcast_id: str) -> None:
    broadcast = await broadcast_repository.get_by_id(db, broadcast_id)
    if broadcast is None or broadcast.deleted_at is not None:
        raise NotFoundError("Broadcast not found")
    if broadcast.sender_id != current_user_id:
        raise ForbiddenError("You can only delete your own broadcasts")

    await broadcast_repository.soft_delete(db, broadcast)
    await db.commit()


async def hide_broadcast(db: AsyncSession, current_user_id: uuid.UUID, broadcast_id: str) -> None:
    broadcast = await broadcast_repository.get_by_id(db, broadcast_id)
    if broadcast is None or broadcast.deleted_at is not None:
        raise NotFoundError("Broadcast not found")
    if broadcast.sender_id == current_user_id:
        raise ValidationError("Delete your own broadcast instead of hiding it")

    await broadcast_repository.hide_for_user(db, current_user_id, broadcast.id)
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
    cards = await serialize_echo_rows(db, user_id, [parent_row, *replies])
    return {"parent": cards[0], "replies": cards[1:]}
