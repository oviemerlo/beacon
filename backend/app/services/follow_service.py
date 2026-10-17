import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import block_repository, follow_repository, upload_repository, user_repository
from app.services.exceptions import ForbiddenError, NotFoundError


async def follow_user(db: AsyncSession, follower_id: uuid.UUID, followed_id: uuid.UUID) -> None:
    if follower_id == followed_id:
        raise ForbiddenError("Cannot follow yourself")
    target = await user_repository.get_by_id(db, followed_id)
    if target is None or target.is_suspended:
        raise NotFoundError("User not found")
    if await block_repository.is_blocked_either_direction(db, follower_id, followed_id):
        raise ForbiddenError("Unavailable between these users")
    await follow_repository.follow(db, follower_id, followed_id)
    await db.commit()


async def unfollow_user(db: AsyncSession, follower_id: uuid.UUID, followed_id: uuid.UUID) -> None:
    await follow_repository.unfollow(db, follower_id, followed_id)
    await db.commit()


async def list_following(db: AsyncSession, follower_id: uuid.UUID) -> list[dict]:
    users = await follow_repository.list_following(db, follower_id)
    avatars = await upload_repository.latest_clean_avatar_ids_for_users(db, [u.id for u in users])
    return [
        {
            "id": str(u.id),
            "username": u.username,
            "display_name": u.display_name,
            "account_type": u.account_type,
            "is_verified": u.is_verified,
            "avatar_file_id": str(avatars[u.id]) if avatars.get(u.id) else None,
        }
        for u in users
    ]


async def search_users(db, viewer_id: uuid.UUID, query: str, limit: int = 20) -> list[dict]:
    keyword = query.strip().lstrip("@")
    if not keyword:
        return []
    matches = await user_repository.search_by_handle_prefix(db, keyword, exclude_user_id=viewer_id, limit=limit)
    following_ids = await follow_repository.get_following_ids_for_set(db, viewer_id, [u.id for u in matches])
    avatars = await upload_repository.latest_clean_avatar_ids_for_users(db, [u.id for u in matches])
    return [
        {
            "id": str(u.id),
            "username": u.username,
            "display_name": u.display_name,
            "account_type": u.account_type,
            "is_verified": u.is_verified,
            "is_following": u.id in following_ids,
            "avatar_file_id": str(avatars[u.id]) if avatars.get(u.id) else None,
        }
        for u in matches
    ]


async def get_profile_for_viewer(db, viewer_id: uuid.UUID, target_id: uuid.UUID) -> dict:
    target = await user_repository.get_by_id(db, target_id)
    if target is None or target.is_suspended:
        raise NotFoundError("User not found")
    avatars = await upload_repository.latest_clean_avatar_ids_for_users(db, [target.id])
    return {
        "id": str(target.id),
        "username": target.username,
        "display_name": target.display_name,
        "account_type": target.account_type,
        "is_verified": target.is_verified,
        "is_following": await follow_repository.is_following(db, viewer_id, target_id),
        "avatar_file_id": str(avatars[target.id]) if avatars.get(target.id) else None,
    }
