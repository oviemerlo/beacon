"""Data access for cached link previews and per-item joins."""

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.link_preview import BroadcastLinkPreview, LinkPreview, MessageLinkPreview


async def get_by_normalized_url(db: AsyncSession, normalized_url: str) -> LinkPreview | None:
    result = await db.execute(select(LinkPreview).where(LinkPreview.normalized_url == normalized_url))
    return result.scalar_one_or_none()


async def upsert(
    db: AsyncSession,
    *,
    normalized_url: str,
    title: str | None,
    description: str | None,
    image_url: str | None,
    site_name: str | None,
    favicon_url: str | None,
    status: str,
    fetched_at: datetime,
) -> LinkPreview:
    values = {
        "id": uuid.uuid4(),
        "normalized_url": normalized_url[:2048],
        "title": (title or None) and title[:500],
        "description": description,
        "image_url": (image_url or None) and image_url[:2048],
        "site_name": (site_name or None) and site_name[:200],
        "favicon_url": (favicon_url or None) and favicon_url[:2048],
        "status": status,
        "fetched_at": fetched_at,
    }
    stmt = (
        insert(LinkPreview)
        .values(**values)
        .on_conflict_do_update(
            index_elements=["normalized_url"],
            set_={
                "title": values["title"],
                "description": values["description"],
                "image_url": values["image_url"],
                "site_name": values["site_name"],
                "favicon_url": values["favicon_url"],
                "status": status,
                "fetched_at": fetched_at,
            },
        )
        .returning(LinkPreview)
    )
    row = (await db.scalars(stmt)).one()
    await db.flush()
    return row


async def link_to_broadcast(db: AsyncSession, broadcast_id: uuid.UUID, preview_id: uuid.UUID, sort_index: int) -> None:
    stmt = (
        insert(BroadcastLinkPreview)
        .values(broadcast_id=broadcast_id, link_preview_id=preview_id, sort_index=sort_index)
        .on_conflict_do_nothing()
    )
    await db.execute(stmt)
    await db.flush()


async def link_to_message(db: AsyncSession, message_id: uuid.UUID, preview_id: uuid.UUID, sort_index: int) -> None:
    stmt = (
        insert(MessageLinkPreview)
        .values(message_id=message_id, link_preview_id=preview_id, sort_index=sort_index)
        .on_conflict_do_nothing()
    )
    await db.execute(stmt)
    await db.flush()


async def list_ok_for_broadcasts(db: AsyncSession, broadcast_ids: list[uuid.UUID]) -> dict[uuid.UUID, list[LinkPreview]]:
    if not broadcast_ids:
        return {}
    result = await db.execute(
        select(BroadcastLinkPreview.broadcast_id, LinkPreview)
        .join(LinkPreview, LinkPreview.id == BroadcastLinkPreview.link_preview_id)
        .where(BroadcastLinkPreview.broadcast_id.in_(broadcast_ids))
        .where(LinkPreview.status == "ok")
        .order_by(BroadcastLinkPreview.sort_index.asc())
    )
    grouped: dict[uuid.UUID, list[LinkPreview]] = {}
    for broadcast_id, preview in result.all():
        grouped.setdefault(broadcast_id, []).append(preview)
    return grouped


async def list_ok_for_messages(db: AsyncSession, message_ids: list[uuid.UUID]) -> dict[uuid.UUID, list[LinkPreview]]:
    if not message_ids:
        return {}
    result = await db.execute(
        select(MessageLinkPreview.message_id, LinkPreview)
        .join(LinkPreview, LinkPreview.id == MessageLinkPreview.link_preview_id)
        .where(MessageLinkPreview.message_id.in_(message_ids))
        .where(LinkPreview.status == "ok")
        .order_by(MessageLinkPreview.sort_index.asc())
    )
    grouped: dict[uuid.UUID, list[LinkPreview]] = {}
    for message_id, preview in result.all():
        grouped.setdefault(message_id, []).append(preview)
    return grouped
