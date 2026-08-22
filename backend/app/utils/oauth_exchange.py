"""
Short-lived, one-time-use codes so the OAuth redirect never puts access/
refresh tokens directly in a URL (browser history, referrer headers, server
logs would all see them otherwise). The backend redirects with just a
`code`; the frontend exchanges it server-side for the actual tokens.

Process-local and in-memory — fine for a single instance. Swap for Redis
with a short TTL once you're running more than one backend worker, since
a code minted on worker A needs to be exchangeable on worker B.
"""

import secrets
import time

_CODE_TTL_SECONDS = 60
_store: dict[str, tuple[str, str, float]] = {}  # code -> (access_token, refresh_token, expires_at)


def create_exchange_code(access_token: str, refresh_token: str) -> str:
    code = secrets.token_urlsafe(32)
    _store[code] = (access_token, refresh_token, time.time() + _CODE_TTL_SECONDS)
    return code


def consume_exchange_code(code: str) -> tuple[str, str] | None:
    """One-time use: the entry is removed whether or not it was still valid."""
    entry = _store.pop(code, None)
    if entry is None:
        return None
    access_token, refresh_token, expires_at = entry
    if time.time() > expires_at:
        return None
    return access_token, refresh_token
