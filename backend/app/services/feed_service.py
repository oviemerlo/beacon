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

from app.repositories import broadcast_repository, feed_search_repository, user_repository
from app.services import user_service
from app.services.broadcast_tags import attach_course_codes, attach_sender_avatars, serialize_echo_rows, serialize_search_hit, tag_payload
from app.services.exceptions import ValidationError


async def _serve_feed_rows(db: AsyncSession, user_id: uuid.UUID, rows):
    for row in rows:
        await broadcast_repository.record_impression(db, row[0].id, user_id)
    await db.commit()
    return await serialize_echo_rows(db, user_id, rows)


async def get_for_you_feed(
    db: AsyncSession,
    user_id: uuid.UUID,
    limit: int,
    offset: int,
    tag_ids: list[int] | None = None,
    course_codes: list[str] | None = None,
):
    rows = await broadcast_repository.for_you_feed(db, user_id, limit, offset, tag_ids, course_codes)
    return await _serve_feed_rows(db, user_id, rows)


async def get_opt_in_feed(db: AsyncSession, user_id: uuid.UUID, limit: int, offset: int):
    rows = await broadcast_repository.opt_in_feed(db, user_id, limit, offset)
    return await _serve_feed_rows(db, user_id, rows)


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


async def search_history(db: AsyncSession, user_id: uuid.UUID, query: str, tag_ids: list[int], course_codes: list[str] | None = None):
    keyword = query.strip()
    if not keyword:
        raise ValidationError("A keyword is required")
    hits = await feed_search_repository.search_history(db, user_id, keyword, tag_ids, course_codes)
    viewer_tags = await user_service.list_identity_tags(db, user_id)
    payloads = [serialize_search_hit(hit, user_id, viewer_tags) for hit in hits]
    await attach_sender_avatars(db, payloads, [hit.broadcast for hit in hits])
    await attach_course_codes(db, payloads, [hit.broadcast for hit in hits])
    return payloads


async def list_history_tags(db: AsyncSession, user_id: uuid.UUID):
    """Filter chips for history search: current identity tags, not stale echo tags."""
    return [tag_payload(tag) for tag in await user_service.list_identity_tags(db, user_id)]
