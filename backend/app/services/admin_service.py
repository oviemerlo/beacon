import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.repositories import user_repository
from app.services.exceptions import NotFoundError


def _admin_user_payload(user: User, email: str | None) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "display_name": user.display_name,
        "email": email,
        "is_admin": user.is_admin,
        "is_verified": user.is_verified,
        "created_at": user.created_at,
    }


async def get_signup_stats(db: AsyncSession) -> dict[str, int]:
    total_users, total_suspended_users, new_users_7d = await user_repository.admin_signup_stats(db)
    return {
        "total_users": total_users,
        "total_suspended_users": total_suspended_users,
        "new_users_7d": new_users_7d,
    }


async def list_users(db: AsyncSession, q: str | None = None) -> list[dict]:
    query = (q or "").strip()
    if query:
        found = await user_repository.get_by_email(db, query)
        users = [found] if found else []
    else:
        users = await user_repository.list_admins(db)
    emails = await user_repository.oauth_emails_for_users(db, [user.id for user in users])
    return [_admin_user_payload(user, emails.get(user.id)) for user in users]


async def set_user_admin(db: AsyncSession, user_id: str, is_admin: bool) -> dict:
    user = await user_repository.set_admin(db, uuid.UUID(user_id), is_admin)
    if user is None:
        raise NotFoundError("User not found")
    await db.commit()
    emails = await user_repository.oauth_emails_for_users(db, [user.id])
    return _admin_user_payload(user, emails.get(user.id))
