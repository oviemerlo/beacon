import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.schemas import (
    AcceptTermsIn,
    DmSettingsIn,
    FollowedTagsOut,
    FollowedTagsReplaceIn,
    FollowingListItemOut,
    FollowTargetOut,
    ProfileUpdateIn,
    SetDisciplineIn,
    SetupStatusOut,
    UserProfileOut,
)
from app.services import conversation_service, follow_service, user_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/search", response_model=list[FollowTargetOut])
async def search_users(q: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await follow_service.search_users(db, current_user.id, q)


@router.get("/me/following", response_model=list[FollowingListItemOut])
async def list_following(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await follow_service.list_following(db, current_user.id)


@router.get("/me", response_model=UserProfileOut)
async def get_my_profile(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await user_service.get_profile_with_tags(db, current_user.id)


@router.patch("/me", response_model=UserProfileOut)
async def update_my_profile(payload: ProfileUpdateIn, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await user_service.update_profile(db, current_user, payload)


@router.patch("/me/dm-settings", status_code=200)
async def update_dm_settings(payload: DmSettingsIn, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await conversation_service.update_dm_settings(db, current_user.id, payload.dm_permission, payload.tag_ids)
    return {"status": "ok"}


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


@router.put("/me/discipline")
async def put_discipline(
    payload: SetDisciplineIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tag = await user_service.set_discipline(db, current_user, payload.program_name)
    return {"tag_id": tag.id, "label": tag.label}


@router.post("/me/accept-terms", response_model=UserProfileOut)
async def accept_terms(
    payload: AcceptTermsIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await user_service.accept_terms(db, current_user, payload)


@router.get("/me/setup-status", response_model=SetupStatusOut)
async def get_my_setup_status(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await user_service.get_setup_status(db, current_user)


@router.delete("/me", status_code=204)
async def delete_my_account(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await user_service.delete_account(db, current_user)


@router.get("/{user_id}", response_model=FollowTargetOut)
async def get_user_profile(user_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await follow_service.get_profile_for_viewer(db, current_user.id, user_id)


@router.post("/{user_id}/follow", status_code=200)
async def follow_user(user_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await follow_service.follow_user(db, current_user.id, user_id)
    return {"status": "ok"}


@router.delete("/{user_id}/follow", status_code=204)
async def unfollow_user(user_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await follow_service.unfollow_user(db, current_user.id, user_id)
