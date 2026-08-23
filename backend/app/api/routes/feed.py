from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.schemas import FeedSearchHitOut, TagOut
from app.services import feed_service

router = APIRouter(prefix="/feed", tags=["feed"])


def _serialize_broadcast_tags(broadcast):
    return [
        {"id": bt.tag.id, "tag_type": bt.tag.tag_type, "label": bt.tag.label}
        for bt in broadcast.tags
        if bt.tag is not None
    ]


@router.get("/for-you")
async def for_you_feed(limit: int = 30, offset: int = 0, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = await feed_service.get_for_you_feed(db, current_user.id, limit, offset)
    return [
        {
            "id": str(b.id),
            "sender_id": str(b.sender_id),
            "sender_display_name": b.sender.display_name if b.sender is not None else "Unknown",
            "content": b.content,
            "distance_m": round(distance, 1),
            "shared_tag_count": shared,
            "tags": _serialize_broadcast_tags(b),
            "is_global": b.is_global,
            "radius_meters": b.radius_meters,
            "course_code": b.course_code,
            "created_at": b.created_at,
            "reply_count": int(reply_count or 0),
        }
        for b, distance, shared, reply_count in rows
    ]


@router.get("/opt-in")
async def opt_in_feed(limit: int = 30, offset: int = 0, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = await feed_service.get_opt_in_feed(db, current_user.id, limit, offset)
    return [
        {
            "id": str(b.id),
            "sender_id": str(b.sender_id),
            "sender_display_name": b.sender.display_name if b.sender is not None else "Unknown",
            "content": b.content,
            "distance_m": round(distance, 1),
            "tags": _serialize_broadcast_tags(b),
            "is_global": b.is_global,
            "radius_meters": b.radius_meters,
            "course_code": b.course_code,
            "created_at": b.created_at,
            "reply_count": int(reply_count or 0),
        }
        for b, distance, reply_count in rows
    ]


@router.get("/unread-count")
async def unread_count(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    count = await feed_service.get_unread_count(db, current_user.id)
    return {"count": count}


@router.post("/mark-seen")
async def mark_seen(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await feed_service.mark_feed_seen(db, current_user.id)
    return {"status": "ok"}


def _parse_tag_ids(tags: str | None) -> list[int]:
    if not tags:
        return []
    ids: list[int] = []
    for part in tags.split(","):
        part = part.strip()
        if part.isdigit():
            ids.append(int(part))
    return ids


def _serialize_search_hit(hit) -> dict:
    broadcast = hit.broadcast
    return {
        "id": str(broadcast.id),
        "body": broadcast.content,
        "created_at": broadcast.created_at,
        "match_type": hit.match_type,
        "sender_id": str(broadcast.sender_id),
        "sender_display_name": broadcast.sender.display_name if broadcast.sender is not None else "Unknown",
        "tags": _serialize_broadcast_tags(broadcast),
        "matches": [
            {
                "id": str(match.id),
                "body": match.body,
                "created_at": match.created_at,
                "source": match.source,
                "conversation_id": str(match.conversation_id) if match.conversation_id else None,
            }
            for match in hit.matches
        ],
    }


@router.get("/search", response_model=list[FeedSearchHitOut])
async def search_feed_history(
    q: str,
    tags: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    hits = await feed_service.search_history(db, current_user.id, q, _parse_tag_ids(tags))
    return [_serialize_search_hit(hit) for hit in hits]


@router.get("/search-tags", response_model=list[TagOut])
async def search_feed_history_tags(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tags = await feed_service.list_history_tags(db, current_user.id)
    return [{"id": tag.id, "tag_type": tag.tag_type, "label": tag.label} for tag in tags]
