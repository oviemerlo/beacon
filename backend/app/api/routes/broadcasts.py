from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.schemas import BroadcastCreateIn
from app.services import broadcast_service

router = APIRouter(prefix="/broadcasts", tags=["broadcasts"])


@router.post("", status_code=201)
async def create_broadcast(payload: BroadcastCreateIn, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    broadcast = await broadcast_service.create_broadcast(db, current_user.id, payload)
    return {"id": str(broadcast.id), "created_at": broadcast.created_at}


@router.delete("/{broadcast_id}", status_code=204)
async def delete_broadcast(broadcast_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await broadcast_service.delete_broadcast(db, current_user.id, broadcast_id)
