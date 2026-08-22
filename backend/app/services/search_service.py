"""Username search — validation lives here, the narrow query lives in the repository."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.config import settings
from app.models.user import User
from app.repositories import user_repository
from app.services.exceptions import ValidationError


async def search_usernames(db: AsyncSession, query: str) -> list[User]:
    if len(query) < settings.USERNAME_SEARCH_MIN_CHARS:
        raise ValidationError(f"Query must be at least {settings.USERNAME_SEARCH_MIN_CHARS} characters")
    return await user_repository.search_by_username_prefix(db, query, settings.USERNAME_SEARCH_MAX_RESULTS)
