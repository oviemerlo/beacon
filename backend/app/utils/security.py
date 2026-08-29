from datetime import datetime, timedelta, timezone
from uuid import UUID
import hashlib
import secrets

from jose import JWTError, jwt

from app.utils.config import settings


def create_access_token(user_id: UUID) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "exp": expire, "type": "access"}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(user_id: UUID) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {"sub": str(user_id), "exp": expire, "type": "refresh"}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError as e:
        raise ValueError("Invalid or expired token") from e


def constant_time_secret_matches(provided: str | None, expected: str) -> bool:
    """Compare a request header to a configured secret without leaking length.

    An empty expected value never matches, so unset env vars keep internal
    routes closed.
    """
    if not expected:
        return False
    provided_digest = hashlib.sha256((provided or "").encode("utf-8")).digest()
    expected_digest = hashlib.sha256(expected.encode("utf-8")).digest()
    return secrets.compare_digest(provided_digest, expected_digest)
