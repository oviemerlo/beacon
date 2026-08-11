"""
Data access for User, OAuthAccount, UserTag, UserFollowedTag. This is the
ONLY module that queries the users table — that's deliberate, not
incidental. Per docs/PRODUCT_BRIEF.md, there is no user-search-by-location-
or-tag endpoint anywhere in this app; centralizing all user queries here
means that rule has exactly one file to audit, instead of being an implicit
convention that a new query added to some route could quietly violate.

Repositories never commit — they flush (to get generated IDs / satisfy
FK constraints within the same transaction) and let the calling service
own the commit/rollback boundary. This keeps a service free to make several
repository calls that either all succeed or all roll back together.
"""

import uuid
from datetime import datetime

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tag import UserFollowedTag, UserTag
from app.models.user import OAuthAccount, User
from sqlalchemy.orm import selectinload

async def get_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    return await db.get(User, user_id)

async def get_by_id_with_tags(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    """
    Use this (not get_by_id) anywhere the result will be serialized with
    its `tags` field. Both user_tags AND each row's nested `.tag` need
    eager loading, or Pydantic's serialization hits MissingGreenlet.
    """
    result = await db.execute(
        select(User).where(User.id == user_id).options(selectinload(User.user_tags).selectinload(UserTag.tag))
    )
    return result.scalar_one_or_none()

async def get_by_username(db: AsyncSession, username: str) -> User | None:
    result = await db.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()


async def username_exists(db: AsyncSession, username: str) -> bool:
    result = await db.execute(select(User.id).where(User.username == username))
    return result.scalar_one_or_none() is not None


async def search_by_username_prefix(db: AsyncSession, prefix: str, limit: int) -> list[User]:
    """
    The ONLY user query exposed to search — exact/prefix match on username,
    nothing else. See app/services/search_service.py for the length/rate
    validation around this.
    """
    result = await db.execute(select(User).where(User.username.ilike(f"{prefix}%")).order_by(User.username).limit(limit))
    return list(result.scalars().all())


def build_new_user(username: str, display_name: str) -> User:
    """Constructs (but doesn't persist) a new user with a placeholder
    location — onboarding is responsible for setting a real one."""
    return User(username=username, display_name=display_name, location="SRID=4326;POINT(0 0)")


async def add(db: AsyncSession, user: User) -> User:
    db.add(user)
    await db.flush()
    return user


async def update_fields(db: AsyncSession, user: User, **fields) -> User:
    for key, value in fields.items():
        if value is not None:
            setattr(user, key, value)
    await db.flush()
    return user


async def replace_tags(db: AsyncSession, user_id: uuid.UUID, tag_ids: list[int]) -> None:
    await db.execute(UserTag.__table__.delete().where(UserTag.user_id == user_id))
    for tag_id in tag_ids:
        db.add(UserTag(user_id=user_id, tag_id=tag_id))
    await db.flush()


async def follow_tag(db: AsyncSession, user_id: uuid.UUID, tag_id: int, notifications_enabled: bool) -> None:
    existing = await db.get(UserFollowedTag, (user_id, tag_id))
    if existing:
        existing.notifications_enabled = notifications_enabled
    else:
        db.add(UserFollowedTag(user_id=user_id, tag_id=tag_id, notifications_enabled=notifications_enabled))
    await db.flush()


async def unfollow_tag(db: AsyncSession, user_id: uuid.UUID, tag_id: int) -> None:
    await db.execute(UserFollowedTag.__table__.delete().where(UserFollowedTag.user_id == user_id, UserFollowedTag.tag_id == tag_id))
    await db.flush()


async def list_followed_tag_ids(db: AsyncSession, user_id: uuid.UUID) -> list[int]:
    result = await db.execute(select(UserFollowedTag.tag_id).where(UserFollowedTag.user_id == user_id))
    return list(result.scalars().all())


async def get_oauth_account(db: AsyncSession, provider: str, provider_user_id: str) -> OAuthAccount | None:
    result = await db.execute(
        select(OAuthAccount).where(OAuthAccount.provider == provider, OAuthAccount.provider_user_id == provider_user_id)
    )
    return result.scalar_one_or_none()


async def add_oauth_account(db: AsyncSession, user_id: uuid.UUID, provider: str, provider_user_id: str, email: str | None) -> OAuthAccount:
    account = OAuthAccount(user_id=user_id, provider=provider, provider_user_id=provider_user_id, email=email)
    db.add(account)
    await db.flush()
    return account


async def list_all(db: AsyncSession) -> list[User]:
    """Used by the digest job to iterate every user. Fine at current scale;
    paginate this once the user count makes a single SELECT * impractical."""
    result = await db.execute(select(User))
    return list(result.scalars().all())


async def admin_signup_stats(db: AsyncSession) -> tuple[int, int, int]:
    total_users_result = await db.execute(select(func.count(User.id)))
    suspended_users_result = await db.execute(select(func.count(User.id)).where(User.is_suspended.is_(True)))
    new_users_7d_result = await db.execute(
        select(func.count(User.id)).where(User.created_at >= func.now() - text("interval '7 days'"))
    )
    return (
        int(total_users_result.scalar_one() or 0),
        int(suspended_users_result.scalar_one() or 0),
        int(new_users_7d_result.scalar_one() or 0),
    )


async def set_last_digest_sent(db: AsyncSession, user: User, when: datetime) -> None:
    user.last_digest_sent_at = when
    await db.flush()


async def suspend_user(db: AsyncSession, user: User, reason: str | None, when: datetime) -> User:
    user.is_suspended = True
    user.suspended_reason = reason
    user.suspended_at = when
    await db.flush()
    return user


async def count_users_sharing_tags_created_since(db: AsyncSession, user_id: uuid.UUID, within_meters: int, since_days: int) -> int:
    """
    Aggregate-only count for the digest ("N people who share your tags
    joined nearby this week"). Deliberately returns a COUNT, never the
    underlying rows — see docs/PRODUCT_BRIEF.md '§Why the digest is
    aggregate-only' for why a list here would defeat the entire point of
    not having a user-search endpoint.
    """
    user_loc = select(User.location).where(User.id == user_id).scalar_subquery()
    shared_tag_ids = select(UserTag.tag_id).where(UserTag.user_id == user_id).scalar_subquery()

    stmt = (
        select(func.count(func.distinct(User.id)))
        .join(UserTag, UserTag.user_id == User.id)
        .where(UserTag.tag_id.in_(shared_tag_ids))
        .where(User.id != user_id)
        .where(User.discoverable_in_broadcasts.is_(True))
        .where(User.created_at >= func.now() - text(f"interval '{int(since_days)} days'"))
        .where(func.ST_DWithin(User.location, user_loc, within_meters))
    )
    result = await db.execute(stmt)
    return result.scalar_one() or 0
