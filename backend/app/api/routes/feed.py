from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.services import feed_service

router = APIRouter(prefix="/feed", tags=["feed"])


@router.get("/for-you")
async def for_you_feed(limit: int = 30, offset: int = 0, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = await feed_service.get_for_you_feed(db, current_user.id, limit, offset)
    return [
        {
            "id": str(b.id),
            "sender_id": str(b.sender_id),
            "content": b.content,
            "distance_m": round(distance, 1),
            "shared_tag_count": shared,
            "created_at": b.created_at,
        }
        for b, distance, shared in rows
    ]


@router.get("/opt-in")
async def opt_in_feed(limit: int = 30, offset: int = 0, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = await feed_service.get_opt_in_feed(db, current_user.id, limit, offset)
    return [
        {
            "id": str(b.id),
            "sender_id": str(b.sender_id),
            "content": b.content,
            "distance_m": round(distance, 1),
            "created_at": b.created_at,
        }
        for b, distance in rows
    ]
