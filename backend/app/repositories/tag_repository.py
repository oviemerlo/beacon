"""Data access for Tag. Thin for now — grows once GET /tags exists."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tag import Tag


def normalize_label(raw: str) -> str:
    """Case-insensitive, whitespace-collapsed match key. Distinct from course-code
    canonicalization in app.utils.course_tags, which is letter/digit compacting."""
    return " ".join(raw.strip().split()).lower()


async def list_all(db: AsyncSession) -> list[Tag]:
    result = await db.execute(select(Tag).order_by(Tag.tag_type, Tag.label))
    return list(result.scalars().all())


async def get_by_ids(db: AsyncSession, tag_ids: list[int]) -> list[Tag]:
    if not tag_ids:
        return []
    result = await db.execute(select(Tag).where(Tag.id.in_(tag_ids)))
    return list(result.scalars().all())


async def get_by_id(db: AsyncSession, tag_id: int) -> Tag | None:
    return await db.get(Tag, tag_id)


async def get_by_type_and_label(db: AsyncSession, tag_type: str, label: str) -> Tag | None:
    result = await db.execute(select(Tag).where(Tag.tag_type == tag_type, Tag.label == label))
    return result.scalar_one_or_none()


async def create(db: AsyncSession, *, tag_type: str, label: str) -> Tag:
    tag = Tag(tag_type=tag_type, label=label)
    db.add(tag)
    await db.flush()
    return tag


async def get_or_create(db: AsyncSession, tag_type: str, raw_label: str) -> Tag:
    normalized = normalize_label(raw_label)
    existing = await db.scalar(
        select(Tag).where(Tag.tag_type == tag_type, func.lower(func.trim(Tag.label)) == normalized)
    )
    if existing:
        return existing
    tag = Tag(tag_type=tag_type, label=" ".join(raw_label.strip().split()))
    db.add(tag)
    await db.flush()
    return tag
