from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.schemas import BroadcastCreateIn, BroadcastThreadOut, ReachEstimateOut
from app.services import broadcast_service

router = APIRouter(prefix="/broadcasts", tags=["broadcasts"])


@router.get("/estimate-reach", response_model=ReachEstimateOut)
async def get_estimate_reach(
    tag_ids: list[int] = Query(default=[]),
    radius_meters: int = Query(...),
    tag_match_mode: str = Query(default="any", pattern="^(any|all)$"),
    course_codes: list[str] = Query(default=[]),
    is_global: bool = Query(default=False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await broadcast_service.estimate_reach(
        db,
        current_user,
        tag_ids,
        radius_meters,
        tag_match_mode=tag_match_mode,
        course_codes=course_codes,
        is_global=is_global,
    )


@router.post("", status_code=201)
async def create_broadcast(payload: BroadcastCreateIn, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    broadcast = await broadcast_service.create_broadcast(db, current_user.id, payload)
    return {"id": str(broadcast.id), "created_at": broadcast.created_at}


@router.delete("/{broadcast_id}", status_code=204)
async def delete_broadcast(broadcast_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await broadcast_service.delete_broadcast(db, current_user.id, broadcast_id)


@router.put("/{broadcast_id}/hide", status_code=204)
async def hide_broadcast(broadcast_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await broadcast_service.hide_broadcast(db, current_user.id, broadcast_id)


@router.get("/{broadcast_id}/thread", response_model=BroadcastThreadOut)
async def get_broadcast_thread(
    broadcast_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await broadcast_service.get_broadcast_thread(db, current_user.id, broadcast_id)
