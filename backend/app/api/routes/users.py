from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.schemas import FollowedTagsOut, FollowedTagsReplaceIn, ProfileUpdateIn, UserProfileOut
from app.services import user_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserProfileOut)
async def get_my_profile(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await user_service.get_profile_with_tags(db, current_user.id)


@router.patch("/me", response_model=UserProfileOut)
async def update_my_profile(payload: ProfileUpdateIn, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await user_service.update_profile(db, current_user, payload)


@router.put("/me/followed-tags", response_model=FollowedTagsOut)
async def replace_followed_tags(
    payload: FollowedTagsReplaceIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await user_service.replace_followed_tags(db, current_user.id, payload)


@router.put("/me/followed-tags/{tag_id}")
async def follow_tag(tag_id: int, notifications_enabled: bool = False, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await user_service.follow_tag(db, current_user.id, tag_id, notifications_enabled)
    return {"status": "ok"}


@router.delete("/me/followed-tags/{tag_id}")
async def unfollow_tag(tag_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await user_service.unfollow_tag(db, current_user.id, tag_id)
    return {"status": "ok"}


@router.get("/me/followed-tags", response_model=FollowedTagsOut)
async def list_followed_tags(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await user_service.get_followed_tags(db, current_user.id)
