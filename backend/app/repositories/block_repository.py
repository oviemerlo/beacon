"""Data access for BlockedUser."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import BlockedUser
from app.models.user import User


async def block_user(db: AsyncSession, blocker_id: uuid.UUID, blocked_id: uuid.UUID) -> None:
    existing = await db.get(BlockedUser, (blocker_id, blocked_id))
    if existing is None:
        db.add(BlockedUser(blocker_id=blocker_id, blocked_id=blocked_id))
        await db.flush()


async def unblock_user(db: AsyncSession, blocker_id: uuid.UUID, blocked_id: uuid.UUID) -> None:
    existing = await db.get(BlockedUser, (blocker_id, blocked_id))
    if existing is not None:
        await db.delete(existing)
        await db.flush()


async def list_blocked_user_ids(db: AsyncSession, blocker_id: uuid.UUID) -> list[uuid.UUID]:
    result = await db.execute(select(BlockedUser.blocked_id).where(BlockedUser.blocker_id == blocker_id))
    return list(result.scalars().all())


async def list_blocked_users(db: AsyncSession, blocker_id: uuid.UUID) -> list[User]:
    result = await db.execute(
        select(User)
        .join(BlockedUser, BlockedUser.blocked_id == User.id)
        .where(BlockedUser.blocker_id == blocker_id)
        .order_by(User.username)
    )
    return list(result.scalars().all())


async def is_blocked(db: AsyncSession, blocker_id: uuid.UUID, blocked_id: uuid.UUID) -> bool:
    result = await db.execute(
        select(BlockedUser.blocker_id).where(
            BlockedUser.blocker_id == blocker_id,
            BlockedUser.blocked_id == blocked_id,
        )
    )
    return result.scalar_one_or_none() is not None


async def is_blocked_either_direction(db: AsyncSession, user_a: uuid.UUID, user_b: uuid.UUID) -> bool:
    result = await db.execute(
        select(BlockedUser.blocker_id).where(
            ((BlockedUser.blocker_id == user_a) & (BlockedUser.blocked_id == user_b))
            | ((BlockedUser.blocker_id == user_b) & (BlockedUser.blocked_id == user_a))
        )
    )
    return result.scalar_one_or_none() is not None
