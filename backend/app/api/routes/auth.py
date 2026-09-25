"""
OAuth flow (see docs/SECURITY_FIXES.md for the full history):

  Web (browser redirect): GET /auth/google/login -> Google -> GET
  /auth/google/callback -> we mint a one-time exchange code
  (app/utils/oauth_exchange.py) and redirect to the frontend, which trades
  it for real tokens via POST /auth/exchange.

  Mobile (native SDK): client POSTs a provider identity token to
  /auth/{provider}/token-exchange, which is verified (app/utils/oauth_verify.py)
  before anything in it is trusted.

Identity upsert and token issuance are auth_service's job, not this file's
— this route module only handles the HTTP/OAuth-client plumbing (Authlib
registration, redirect construction, request parsing).
"""

import logging

from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.config import settings
from app.utils.rate_limit import limiter
from app.utils.oauth_exchange import consume_exchange_code, create_exchange_code
from app.utils.apple_client import exchange_authorization_code
from app.utils.oauth_verify import TokenVerificationError, verify_apple_identity_token, verify_google_id_token
from app.db.session import get_db
from app.schemas.schemas import AppleTokenExchangeIn, ExchangeCodeIn, GoogleTokenExchangeIn, RefreshIn, TokenPairOut
from app.services import auth_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

oauth = OAuth()
oauth.register(
    name="google",
    client_id=settings.GOOGLE_CLIENT_ID,
    client_secret=settings.GOOGLE_CLIENT_SECRET,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)


@router.get("/google/login")
async def google_login(request: Request):
    return await oauth.google.authorize_redirect(request, settings.GOOGLE_REDIRECT_URI)


@router.get("/google/callback")
async def google_callback(request: Request, db: AsyncSession = Depends(get_db)):
    token = await oauth.google.authorize_access_token(request)
    userinfo = token.get("userinfo") or await oauth.google.userinfo(token=token)

    user = await auth_service.upsert_user_from_identity(
        db, provider="google", provider_user_id=userinfo["sub"], email=userinfo.get("email"), name=userinfo.get("name")
    )
    tokens = auth_service.issue_tokens(user)

    code = create_exchange_code(tokens.access_token, tokens.refresh_token)
    return RedirectResponse(f"{settings.FRONTEND_URL}/auth/exchange?code={code}")


@router.post("/exchange", response_model=TokenPairOut)
@limiter.limit("10/minute")
async def exchange_code(request: Request, body: ExchangeCodeIn):
    _ = request
    result = consume_exchange_code(body.code)
    if result is None:
        raise HTTPException(400, "Invalid or expired exchange code")
    access_token, refresh_token = result
    return TokenPairOut(access_token=access_token, refresh_token=refresh_token)


@router.post("/google/token-exchange", response_model=TokenPairOut)
@limiter.limit("10/minute")
async def google_token_exchange(request: Request, body: GoogleTokenExchangeIn, db: AsyncSession = Depends(get_db)):
    _ = request
    try:
        claims = verify_google_id_token(body.id_token)
    except TokenVerificationError as e:
        raise HTTPException(401, f"Google identity token failed verification: {e}")

    user = await auth_service.upsert_user_from_identity(
        db, provider="google", provider_user_id=claims["sub"], email=claims.get("email"), name=claims.get("name")
    )
    return auth_service.issue_tokens(user)


@router.post("/apple/token-exchange", response_model=TokenPairOut)
@limiter.limit("10/minute")
async def apple_token_exchange(
    request: Request,
    body: AppleTokenExchangeIn,
    db: AsyncSession = Depends(get_db),
):
    _ = request
    try:
        claims = await verify_apple_identity_token(body.identity_token)
    except TokenVerificationError as e:
        raise HTTPException(401, f"Apple identity token failed verification: {e}")

    user = await auth_service.upsert_user_from_identity(
        db, provider="apple", provider_user_id=claims["sub"], email=claims.get("email"), name=body.full_name
    )
    if body.authorization_code:
        try:
            apple_refresh = await exchange_authorization_code(body.authorization_code)
            if apple_refresh:
                await auth_service.store_apple_refresh_token(db, claims["sub"], apple_refresh)
        except Exception:
            logger.error("apple refresh token was not stored")
    return auth_service.issue_tokens(user)


@router.post("/refresh", response_model=TokenPairOut)
@limiter.limit("30/minute")
async def refresh_token(request: Request, body: RefreshIn, db: AsyncSession = Depends(get_db)):
    _ = request
    return await auth_service.refresh_token_pair(db, body.refresh_token)
