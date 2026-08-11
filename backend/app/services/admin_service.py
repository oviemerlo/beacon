from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import user_repository


async def get_signup_stats(db: AsyncSession) -> dict[str, int]:
    total_users, total_suspended_users, new_users_7d = await user_repository.admin_signup_stats(db)
    return {
        "total_users": total_users,
        "total_suspended_users": total_suspended_users,
        "new_users_7d": new_users_7d,
    }
