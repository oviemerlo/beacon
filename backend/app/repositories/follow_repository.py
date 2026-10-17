import uuid

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.follow import UserFollow
from app.models.user import User


def followed_ids_subquery(follower_id: uuid.UUID):
    """Used inside broadcast_repository's _in_reach — kept as a bare subquery,
    not a service call, to stay inside the same SQL statement."""
    return select(UserFollow.followed_id).where(UserFollow.follower_id == follower_id)


async def is_following(db: AsyncSession, follower_id: uuid.UUID, followed_id: uuid.UUID) -> bool:
    result = await db.execute(
        select(UserFollow.follower_id).where(UserFollow.follower_id == follower_id, UserFollow.followed_id == followed_id).limit(1)
    )
    return result.scalar_one_or_none() is not None


async def follow(db: AsyncSession, follower_id: uuid.UUID, followed_id: uuid.UUID) -> None:
    await db.execute(
        pg_insert(UserFollow)
        .values(follower_id=follower_id, followed_id=followed_id)
        .on_conflict_do_nothing(index_elements=["follower_id", "followed_id"])
    )


async def unfollow(db: AsyncSession, follower_id: uuid.UUID, followed_id: uuid.UUID) -> None:
    await db.execute(delete(UserFollow).where(UserFollow.follower_id == follower_id, UserFollow.followed_id == followed_id))


async def list_following(db: AsyncSession, follower_id: uuid.UUID) -> list[User]:
    result = await db.execute(
        select(User)
        .join(UserFollow, UserFollow.followed_id == User.id)
        .where(UserFollow.follower_id == follower_id)
        .order_by(User.display_name)
    )
    return list(result.scalars().all())


async def get_following_ids_for_set(db: AsyncSession, follower_id: uuid.UUID, candidate_ids: list[uuid.UUID]) -> set[uuid.UUID]:
    """Batch check — which of these sender ids does the viewer already follow.
    Used when serializing a page of feed cards so each one can show the right
    Follow/Following button state without N+1 queries."""
    if not candidate_ids:
        return set()
    result = await db.execute(
        select(UserFollow.followed_id).where(UserFollow.follower_id == follower_id, UserFollow.followed_id.in_(candidate_ids))
    )
    return {row[0] for row in result.all()}
