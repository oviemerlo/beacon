"""
Real verification for both providers' identity tokens. This is what
app/api/routes/auth.py's token-exchange endpoints must call instead of
`jose_jwt.decode(token, key=None)` — decoding without a key does NOT check
the signature, so a forged token with any `sub` claim would previously be
accepted at face value. That's fixed here.
"""

import time

import httpx
from cachetools import TTLCache
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from jose import jwt as jose_jwt
from jose.exceptions import JWTError
from google.auth import exceptions as google_exceptions

from app.core.config import settings

_google_request = google_requests.Request()

# Apple's JWKS rotates infrequently; cache for an hour rather than fetching
# on every login. TTLCache is process-local — fine for a single instance,
# swap for a shared cache (Redis) once you're running more than one worker.
_apple_jwks_cache: TTLCache = TTLCache(maxsize=1, ttl=3600)
APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys"
APPLE_ISSUER = "https://appleid.apple.com"


class TokenVerificationError(Exception):
    pass


def verify_google_id_token(id_token_str: str) -> dict:
    """
    Verifies signature against Google's published certs and expiry via
    google-auth, then checks the token's audience against EVERY Google
    client ID this app owns (web + mobile — see
    Settings.google_allowed_audiences), not just one.
    """
    allowed_audiences = settings.google_allowed_audiences
    if not allowed_audiences:
        raise TokenVerificationError("No Google client IDs configured (GOOGLE_CLIENT_ID / GOOGLE_MOBILE_CLIENT_IDS)")

    try:
        claims = google_id_token.verify_oauth2_token(id_token_str, _google_request, audience=None)
    except (ValueError, google_exceptions.GoogleAuthError) as e:
        raise TokenVerificationError(str(e)) from e

    if claims.get("aud") not in allowed_audiences:
        raise TokenVerificationError("Token audience does not match any configured Google client ID")
    if claims.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise TokenVerificationError("Unexpected issuer")
    return claims

async def _get_apple_jwks() -> dict:
    cached = _apple_jwks_cache.get("jwks")
    if cached is not None:
        return cached
    async with httpx.AsyncClient(timeout=5.0) as client:
        resp = await client.get(APPLE_JWKS_URL)
        resp.raise_for_status()
        jwks = resp.json()
    _apple_jwks_cache["jwks"] = jwks
    return jwks


async def verify_apple_identity_token(identity_token: str) -> dict:
    """
    Verifies signature against Apple's published JWKS, matched by `kid`,
    plus issuer/audience/expiry.
    """
    if not settings.APPLE_CLIENT_ID:
        raise TokenVerificationError("APPLE_CLIENT_ID is not configured")

    try:
        unverified_header = jose_jwt.get_unverified_header(identity_token)
    except JWTError as e:
        raise TokenVerificationError("Malformed token header") from e

    jwks = await _get_apple_jwks()
    matching_key = next((k for k in jwks.get("keys", []) if k.get("kid") == unverified_header.get("kid")), None)
    if matching_key is None:
        # Key rotation edge case: force a cache refresh once and retry.
        _apple_jwks_cache.clear()
        jwks = await _get_apple_jwks()
        matching_key = next((k for k in jwks.get("keys", []) if k.get("kid") == unverified_header.get("kid")), None)
        if matching_key is None:
            raise TokenVerificationError("No matching Apple signing key found")

    try:
        claims = jose_jwt.decode(
            identity_token,
            matching_key,
            algorithms=["RS256"],
            audience=settings.APPLE_CLIENT_ID,
            issuer=APPLE_ISSUER,
        )
    except JWTError as e:
        raise TokenVerificationError(f"Apple token verification failed: {e}") from e

    if claims.get("exp", 0) < time.time():
        raise TokenVerificationError("Apple token has expired")
    return claims
