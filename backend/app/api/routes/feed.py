from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
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
            "created_at": b.created_at,
            "reply_count": int(reply_count or 0),
        }
        for b, distance, reply_count in rows
    ]
