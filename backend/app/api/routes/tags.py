from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.repositories import tag_repository
from app.services.regions import ALL_REGIONS, get_countries_for_region

router = APIRouter(prefix="/tags", tags=["tags"])

_REGION_ORDER = {label: index for index, label in enumerate(ALL_REGIONS)}


def _serialize_tag(tag) -> dict:
    item = {"id": tag.id, "tag_type": tag.tag_type, "label": tag.label}
    if tag.tag_type == "region":
        item["countries"] = get_countries_for_region(tag.label)
    return item


@router.get("")
async def list_tags(db: AsyncSession = Depends(get_db)):
    tags = await tag_repository.list_all(db)
    grouped = {"nationality": [], "region": [], "hobby": []}
    for tag in tags:
        if tag.tag_type not in grouped:
            continue
        grouped[tag.tag_type].append(_serialize_tag(tag))
    grouped["region"].sort(key=lambda item: _REGION_ORDER.get(item["label"], len(_REGION_ORDER)))
    for item in grouped["region"]:
        item["label"] = item["label"].replace(" / Hispanic", "")
    return grouped
