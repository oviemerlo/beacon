from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.repositories import tag_repository

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("")
async def list_tags(db: AsyncSession = Depends(get_db)):
    tags = await tag_repository.list_all(db)
    grouped = {"nationality": [], "continent": [], "hobby": [], "community": []}
    for tag in tags:
        if tag.tag_type not in grouped:
            continue
        grouped[tag.tag_type].append({"id": tag.id, "tag_type": tag.tag_type, "label": tag.label})
    return grouped
