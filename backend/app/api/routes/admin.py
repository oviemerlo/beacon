from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.schemas import AdminStatsOut
from app.services import admin_service

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats", response_model=AdminStatsOut)
async def get_admin_stats(
    _: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    return await admin_service.get_signup_stats(db)
