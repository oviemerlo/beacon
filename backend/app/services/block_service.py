import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.repositories import block_repository, user_repository
from app.services.exceptions import NotFoundError, ValidationError


async def block_user(db: AsyncSession, blocker_id: uuid.UUID, blocked_id: uuid.UUID) -> None:
    if blocker_id == blocked_id:
        raise ValidationError("You cannot block yourself")
    blocked_user = await user_repository.get_by_id(db, blocked_id)
    if blocked_user is None:
        raise NotFoundError("User not found")
    await block_repository.block_user(db, blocker_id, blocked_id)
    await db.commit()


async def unblock_user(db: AsyncSession, blocker_id: uuid.UUID, blocked_id: uuid.UUID) -> None:
    await block_repository.unblock_user(db, blocker_id, blocked_id)
    await db.commit()


async def list_blocked_user_ids(db: AsyncSession, blocker_id: uuid.UUID) -> list[uuid.UUID]:
    return await block_repository.list_blocked_user_ids(db, blocker_id)


async def list_blocked_users(db: AsyncSession, blocker_id: uuid.UUID) -> list[User]:
    return await block_repository.list_blocked_users(db, blocker_id)
