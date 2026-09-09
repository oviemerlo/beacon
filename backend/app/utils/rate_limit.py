from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address


def rate_limit_key(request: Request) -> str:
    """Rate limit by authenticated user when available, falling back to IP
    for unauthenticated requests. Prevents one user from bypassing per-account
    limits by rotating IPs, while still covering pre-auth endpoints."""
    user = getattr(request.state, "user", None)
    if user is not None:
        return f"user:{user.id}"
    return get_remote_address(request)


limiter = Limiter(key_func=rate_limit_key)
