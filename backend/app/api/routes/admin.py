from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.schemas import AdminRoleIn, AdminStatsOut, AdminUserOut
from app.services import admin_service
from app.services.exceptions import ForbiddenError

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats", response_model=AdminStatsOut)
async def get_admin_stats(
    _: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    return await admin_service.get_signup_stats(db)


@router.get("/users", response_model=list[AdminUserOut])
async def list_users(
    q: str | None = None,
    _: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    return await admin_service.list_users(db, q)


@router.patch("/users/{user_id}/admin", response_model=AdminUserOut)
async def set_user_admin(
    user_id: str,
    payload: AdminRoleIn,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    if not payload.is_admin and user_id == str(current_user.id):
        raise ForbiddenError("Can't remove your own admin access")
    return await admin_service.set_user_admin(db, user_id, payload.is_admin)
