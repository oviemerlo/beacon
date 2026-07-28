"""Data access for Tag. Thin for now — grows once GET /tags exists."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tag import Tag


async def list_all(db: AsyncSession) -> list[Tag]:
    result = await db.execute(select(Tag).order_by(Tag.tag_type, Tag.label))
    return list(result.scalars().all())


async def get_by_ids(db: AsyncSession, tag_ids: list[int]) -> list[Tag]:
    if not tag_ids:
        return []
    result = await db.execute(select(Tag).where(Tag.id.in_(tag_ids)))
    return list(result.scalars().all())
