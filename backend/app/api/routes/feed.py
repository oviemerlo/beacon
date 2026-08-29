from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.schemas import FeedSearchHitOut, TagOut
from app.utils.course_tags import canonical_course_tag
from app.services import feed_service

router = APIRouter(prefix="/feed", tags=["feed"])


def _csv_parts(value: str | None) -> list[str]:
    if not value:
        return []
    return [part.strip() for part in value.split(",") if part.strip()]


def _parse_tag_ids(tags: str | None) -> list[int]:
    return [int(part) for part in _csv_parts(tags) if part.isdigit()]


def _parse_course_codes(courses: str | None) -> list[str]:
    codes: list[str] = []
    for part in _csv_parts(courses):
        canonical = canonical_course_tag(part)
        if canonical and canonical not in codes:
            codes.append(canonical)
    return codes


@router.get("/for-you")
async def for_you_feed(
    limit: int = 30,
    offset: int = 0,
    tags: str | None = None,
    courses: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await feed_service.get_for_you_feed(
        db, current_user.id, limit, offset, _parse_tag_ids(tags), _parse_course_codes(courses)
    )


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
    courses: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await feed_service.search_history(
        db, current_user.id, q, _parse_tag_ids(tags), _parse_course_codes(courses)
    )


@router.get("/search-tags", response_model=list[TagOut])
async def search_feed_history_tags(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Tags the viewer currently follows — same set as profile, used to narrow history search."""
    return await feed_service.list_history_tags(db, current_user.id)
