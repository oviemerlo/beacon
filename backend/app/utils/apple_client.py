"""Sign in with Apple client secret, authorization-code exchange, and token revoke."""

import logging
import time
from pathlib import Path

import httpx
from jose import jwt

from app.utils.config import settings

logger = logging.getLogger(__name__)

APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token"
APPLE_REVOKE_URL = "https://appleid.apple.com/auth/revoke"
_SECRET_LIFETIME_SECONDS = 150 * 24 * 60 * 60  # ~5 months; Apple's max is 6
_REFRESH_BEFORE_EXPIRY_SECONDS = 24 * 60 * 60

_cached_secret: str | None = None
_cached_exp: int = 0


def _load_private_key() -> str:
    if settings.APPLE_PRIVATE_KEY.strip():
        return settings.APPLE_PRIVATE_KEY.replace("\\n", "\n")
    if settings.APPLE_PRIVATE_KEY_PATH:
        return Path(settings.APPLE_PRIVATE_KEY_PATH).read_text()
    raise RuntimeError("Apple private key is not configured")


def build_client_secret() -> str:
    global _cached_secret, _cached_exp
    now = int(time.time())
    if _cached_secret is not None and now < _cached_exp - _REFRESH_BEFORE_EXPIRY_SECONDS:
        return _cached_secret

    exp = now + _SECRET_LIFETIME_SECONDS
    token = jwt.encode(
        {
            "iss": settings.APPLE_TEAM_ID,
            "iat": now,
            "exp": exp,
            "aud": "https://appleid.apple.com",
            "sub": settings.APPLE_CLIENT_ID,
        },
        _load_private_key(),
        algorithm="ES256",
        headers={"kid": settings.APPLE_KEY_ID, "alg": "ES256"},
    )
    _cached_secret = token
    _cached_exp = exp
    return token


async def exchange_authorization_code(code: str) -> str | None:
    try:
        client_secret = build_client_secret()
    except Exception:
        logger.error("apple authorization-code exchange skipped: client secret unavailable")
        return None

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                APPLE_TOKEN_URL,
                data={
                    "client_id": settings.APPLE_CLIENT_ID,
                    "client_secret": client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                },
            )
    except httpx.HTTPError:
        logger.error("apple authorization-code exchange failed: request error")
        return None

    if response.status_code != 200:
        logger.error("apple authorization-code exchange failed: status=%s", response.status_code)
        return None
    refresh_token = response.json().get("refresh_token")
    return refresh_token if isinstance(refresh_token, str) and refresh_token else None


async def revoke_refresh_token(refresh_token: str) -> bool:
    try:
        client_secret = build_client_secret()
    except Exception:
        logger.error("apple token revoke skipped: client secret unavailable")
        return False

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                APPLE_REVOKE_URL,
                data={
                    "client_id": settings.APPLE_CLIENT_ID,
                    "client_secret": client_secret,
                    "token": refresh_token,
                    "token_type_hint": "refresh_token",
                },
            )
    except httpx.HTTPError:
        logger.error("apple token revoke failed: request error")
        return False

    if response.status_code != 200:
        logger.error("apple token revoke failed: status=%s", response.status_code)
        return False
    return True
