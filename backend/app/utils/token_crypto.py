"""Encrypt Apple refresh tokens at rest. The key is a Fernet key in APPLE_TOKEN_ENCRYPTION_KEY."""

from cryptography.fernet import Fernet

from app.utils.config import settings


def _fernet() -> Fernet:
    key = settings.APPLE_TOKEN_ENCRYPTION_KEY
    if not key:
        raise RuntimeError("APPLE_TOKEN_ENCRYPTION_KEY is not configured")
    return Fernet(key.encode())


def encrypt(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def decrypt(value: str) -> str:
    return _fernet().decrypt(value.encode()).decode()
