"""Data access for BlockedUser."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import BlockedUser


async def is_blocked_either_direction(db: AsyncSession, user_a: uuid.UUID, user_b: uuid.UUID) -> bool:
    result = await db.execute(
        select(BlockedUser.blocker_id).where(
            ((BlockedUser.blocker_id == user_a) & (BlockedUser.blocked_id == user_b))
            | ((BlockedUser.blocker_id == user_b) & (BlockedUser.blocked_id == user_a))
        )
    )
    return result.scalar_one_or_none() is not None
