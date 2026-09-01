"""Data access for UploadedFile."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.upload import UploadedFile


async def create(
    db: AsyncSession,
    *,
    uploader_user_id: uuid.UUID,
    context: str,
    broadcast_id: uuid.UUID | None,
    s3_key: str,
    original_filename: str,
    content_type: str,
    size_bytes: int,
    moderation_status: str = "pending",
    moderation_labels: str | None = None,
) -> UploadedFile:
    row = UploadedFile(
        uploader_user_id=uploader_user_id,
        context=context,
        broadcast_id=broadcast_id,
        s3_key=s3_key,
        original_filename=original_filename,
        content_type=content_type,
        size_bytes=size_bytes,
        scan_status="pending",
        moderation_status=moderation_status,
        moderation_labels=moderation_labels,
    )
    db.add(row)
    await db.flush()
    return row


async def latest_clean_avatar_ids_for_users(
    db: AsyncSession, user_ids: list[uuid.UUID]
) -> dict[uuid.UUID, uuid.UUID]:
    if not user_ids:
        return {}
    result = await db.execute(
        select(UploadedFile.uploader_user_id, UploadedFile.id)
        .where(UploadedFile.uploader_user_id.in_(user_ids))
        .where(UploadedFile.context == "avatar")
        .where(UploadedFile.scan_status == "clean")
        .distinct(UploadedFile.uploader_user_id)
        .order_by(UploadedFile.uploader_user_id, UploadedFile.created_at.desc())
    )
    return {row[0]: row[1] for row in result.all()}


async def list_clean_attachments_for_broadcasts(
    db: AsyncSession, broadcast_ids: list[uuid.UUID]
) -> dict[uuid.UUID, list[UploadedFile]]:
    if not broadcast_ids:
        return {}
    result = await db.execute(
        select(UploadedFile)
        .where(UploadedFile.broadcast_id.in_(broadcast_ids))
        .where(UploadedFile.context == "broadcast_attachment")
        .where(UploadedFile.scan_status == "clean")
        .order_by(UploadedFile.created_at.asc())
    )
    grouped: dict[uuid.UUID, list[UploadedFile]] = {}
    for row in result.scalars():
        if row.broadcast_id is None:
            continue
        grouped.setdefault(row.broadcast_id, []).append(row)
    return grouped


async def get_latest_avatar_for_user(db: AsyncSession, user_id: uuid.UUID) -> UploadedFile | None:
    result = await db.execute(
        select(UploadedFile)
        .where(UploadedFile.uploader_user_id == user_id)
        .where(UploadedFile.context == "avatar")
        .where(UploadedFile.scan_status.in_(("pending", "clean")))
        .order_by(UploadedFile.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_by_id(db: AsyncSession, file_id: uuid.UUID | str) -> UploadedFile | None:
    return await db.get(UploadedFile, file_id)


async def get_by_s3_key(db: AsyncSession, bucket: str, s3_key: str) -> UploadedFile | None:
    """Lookup by object key. `bucket` is checked by the service against settings."""
    _ = bucket
    result = await db.execute(select(UploadedFile).where(UploadedFile.s3_key == s3_key))
    return result.scalar_one_or_none()


async def set_thumbnail(db: AsyncSession, file_id: uuid.UUID, thumbnail_s3_key: str) -> None:
    row = await db.get(UploadedFile, file_id)
    if row is None:
        return
    row.thumbnail_s3_key = thumbnail_s3_key
    await db.flush()


async def update_scan_status(db: AsyncSession, file_id: uuid.UUID, scan_status: str) -> UploadedFile | None:
    row = await db.get(UploadedFile, file_id)
    if row is None:
        return None
    row.scan_status = scan_status
    await db.flush()
    return row


async def delete(db: AsyncSession, file_id: uuid.UUID) -> None:
    row = await db.get(UploadedFile, file_id)
    if row is None:
        return
    await db.delete(row)
    await db.flush()
