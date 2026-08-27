from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.schemas import FeedSearchHitOut, TagOut
from app.services import feed_service

router = APIRouter(prefix="/feed", tags=["feed"])


def _parse_tag_ids(tags: str | None) -> list[int]:
    if not tags:
        return []
    ids: list[int] = []
    for part in tags.split(","):
        part = part.strip()
        if part.isdigit():
            ids.append(int(part))
    return ids


@router.get("/for-you")
async def for_you_feed(
    limit: int = 30,
    offset: int = 0,
    tags: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await feed_service.get_for_you_feed(db, current_user.id, limit, offset, _parse_tag_ids(tags))


@router.get("/opt-in")
async def opt_in_feed(limit: int = 30, offset: int = 0, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await feed_service.get_opt_in_feed(db, current_user.id, limit, offset)


@router.get("/unread-count")
async def unread_count(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    count = await feed_service.get_unread_count(db, current_user.id)
    return {"count": count}


@router.post("/mark-seen")
async def mark_seen(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await feed_service.mark_feed_seen(db, current_user.id)
    return {"status": "ok"}


@router.get("/search", response_model=list[FeedSearchHitOut])
async def search_feed_history(
    q: str,
    tags: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await feed_service.search_history(db, current_user.id, q, _parse_tag_ids(tags))


@router.get("/search-tags", response_model=list[TagOut])
async def search_feed_history_tags(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Tags the viewer currently follows — same set as profile, used to narrow history search."""
    return await feed_service.list_history_tags(db, current_user.id)
