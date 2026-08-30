"""Broadcast creation/deletion business rules."""

import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.config import settings
from app.models.broadcast import Broadcast
from app.repositories import broadcast_repository, report_repository, school_repository, tag_repository, user_repository
from app.schemas.schemas import BroadcastCreateIn
from app.services.broadcast_tags import serialize_echo_rows
from app.services.exceptions import ForbiddenError, NotFoundError, ValidationError
from app.services import school_service
from app.services.school_service import is_currently_verified, prepare_course_tag
from app.services.text_moderation_service import TextModerationResult, moderate_text
from app.services.user_service import REGION_TAGS_LOCKED_MESSAGE, can_follow_region_tags, can_use_regional_reach

logger = logging.getLogger(__name__)

TEXT_REJECTED_MESSAGE = "This content couldn't be posted. Please revise and try again."
MODERATION_STATUS_CLEAN = "clean"
MODERATION_STATUS_FLAGGED = "flagged"


async def create_broadcast(db: AsyncSession, sender_id: uuid.UUID, payload: BroadcastCreateIn) -> Broadcast:
    tag_ids = list(payload.tag_ids)
    is_global = payload.is_global
    radius_meters = payload.radius_meters
    tag_match_mode = payload.tag_match_mode
    inherited_school_id: int | None = None
    inherited_course_codes: list[str] = []
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
        inherited_course_codes = await broadcast_repository.list_course_codes(db, parent_broadcast.id)
        if not inherited_course_codes and parent_broadcast.course_code:
            inherited_course_codes = [parent_broadcast.course_code]
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

    course_codes: list[str] = list(inherited_course_codes)
    school_id: int | None = inherited_school_id
    requested_courses = [prepare_course_tag(code) for code in payload.course_codes if code and str(code).strip()]
    if payload.course_code and payload.course_code.strip():
        requested_courses.append(prepare_course_tag(payload.course_code))
    requested_courses = list(dict.fromkeys(requested_courses))
    if requested_courses and payload.reply_to_broadcast_id is None:
        verification = await school_repository.get_verification(db, sender_id)
        if verification is None or not is_currently_verified(verification):
            raise ValidationError("Verify your school before targeting a course")

        enrolled = set(await school_service.get_my_courses(db, sender_id))
        missing = [code for code in requested_courses if code not in enrolled]
        if missing:
            raise ValidationError("You can only target course tags you are enrolled in")

        course_codes = requested_courses
        school_id = verification.school_id

    moderation_status = "pending"
    moderation_labels = None
    moderation_result: TextModerationResult | None = None
    if payload.reply_to_broadcast_id is None:
        moderation_result = await moderate_text(payload.content)
        if moderation_result.decision == "reject":
            raise ValidationError(TEXT_REJECTED_MESSAGE)
        moderation_status = MODERATION_STATUS_FLAGGED if moderation_result.decision == "flag" else MODERATION_STATUS_CLEAN
        moderation_labels = moderation_result.raw_result_json

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
        course_codes=course_codes,
        include_sender_avatar=bool(payload.include_sender_avatar),
        moderation_status=moderation_status,
        moderation_labels=moderation_labels,
    )
    if moderation_status == MODERATION_STATUS_FLAGGED:
        await _create_text_moderation_report(db, broadcast.id, moderation_result)
    await db.commit()
    await db.refresh(broadcast)
    return broadcast


async def _create_text_moderation_report(
    db: AsyncSession,
    broadcast_id: uuid.UUID,
    result: TextModerationResult | None,
) -> None:
    admin = await user_repository.get_any_admin_user(db)
    if admin is None:
        logger.error("No admin user to attribute OpenAI auto-report")
        return
    category = result.top_category if result and result.top_category else "unknown"
    score = result.score if result and result.score is not None else 0.0
    await report_repository.create_report(
        db,
        reporter_id=admin.id,
        target_type="broadcast",
        target_id=broadcast_id,
        reason="inappropriate_content",
        details=f"Auto-flagged by OpenAI moderation: {category} ({score:.2f} score)",
    )


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
