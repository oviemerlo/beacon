"""
Identity upsert + token issuance. Called by the OAuth routes after they've
already verified the provider's token (Google via google-auth, Apple via
JWKS — see app/core/oauth_verify.py) or completed the Authlib redirect
flow. This service doesn't verify anything itself — it trusts the caller
already did, same as any service trusts its route to have validated input
shape via Pydantic.
"""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.core.security import create_access_token, create_refresh_token
from app.models.user import User
from app.repositories import user_repository
from app.schemas.schemas import TokenPairOut
from app.services.exceptions import UnauthorizedError


async def upsert_user_from_identity(db: AsyncSession, *, provider: str, provider_user_id: str, email: str | None, name: str | None) -> User:
    _ = name
    existing_account = await user_repository.get_oauth_account(db, provider, provider_user_id)
    if existing_account is not None:
        user = await user_repository.get_by_id(db, existing_account.user_id)
        await db.commit()
        return user

    base_username = (email.split("@")[0] if email else f"user{uuid.uuid4().hex[:8]}").lower()
    username = base_username
    suffix = 0
    while await user_repository.username_exists(db, username):
        suffix += 1
        username = f"{base_username}{suffix}"

    user = user_repository.build_new_user(username=username, display_name=username)
    await user_repository.add(db, user)
    await user_repository.add_oauth_account(db, user.id, provider, provider_user_id, email)
    await db.commit()
    await db.refresh(user)
    return user


def issue_tokens(user: User) -> TokenPairOut:
    return TokenPairOut(access_token=create_access_token(user.id), refresh_token=create_refresh_token(user.id))


async def refresh_token_pair(db: AsyncSession, refresh_token: str) -> TokenPairOut:
    try:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise ValueError
        user_id = uuid.UUID(payload["sub"])
    except (ValueError, KeyError):
        raise UnauthorizedError("Invalid refresh token")

    user = await user_repository.get_by_id(db, user_id)
    if user is None:
        raise UnauthorizedError("User not found")
    return issue_tokens(user)
