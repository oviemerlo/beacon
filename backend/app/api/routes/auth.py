"""
OAuth flow (see docs/SECURITY_FIXES.md for the full history):

  Web (browser redirect): GET /auth/google/login -> Google -> GET
  /auth/google/callback -> we mint a one-time exchange code
  (app/core/oauth_exchange.py) and redirect to the frontend, which trades
  it for real tokens via POST /auth/exchange.

  Mobile (native SDK): client POSTs a provider identity token to
  /auth/{provider}/token-exchange, which is verified (app/core/oauth_verify.py)
  before anything in it is trusted.

Identity upsert and token issuance are auth_service's job, not this file's
— this route module only handles the HTTP/OAuth-client plumbing (Authlib
registration, redirect construction, request parsing).
"""

from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from starlette.requests import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.oauth_exchange import consume_exchange_code, create_exchange_code
from app.core.oauth_verify import TokenVerificationError, verify_apple_identity_token, verify_google_id_token
from app.db.session import get_db
from app.schemas.schemas import TokenPairOut
from app.services import auth_service

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
async def exchange_code(code: str):
    result = consume_exchange_code(code)
    if result is None:
        raise HTTPException(400, "Invalid or expired exchange code")
    access_token, refresh_token = result
    return TokenPairOut(access_token=access_token, refresh_token=refresh_token)


@router.post("/google/token-exchange", response_model=TokenPairOut)
async def google_token_exchange(id_token: str, db: AsyncSession = Depends(get_db)):
    try:
        claims = verify_google_id_token(id_token)
    except TokenVerificationError as e:
        raise HTTPException(401, f"Google identity token failed verification: {e}")

    user = await auth_service.upsert_user_from_identity(
        db, provider="google", provider_user_id=claims["sub"], email=claims.get("email"), name=claims.get("name")
    )
    return auth_service.issue_tokens(user)


@router.post("/apple/token-exchange", response_model=TokenPairOut)
async def apple_token_exchange(identity_token: str, full_name: str | None = None, db: AsyncSession = Depends(get_db)):
    try:
        claims = await verify_apple_identity_token(identity_token)
    except TokenVerificationError as e:
        raise HTTPException(401, f"Apple identity token failed verification: {e}")

    user = await auth_service.upsert_user_from_identity(
        db, provider="apple", provider_user_id=claims["sub"], email=claims.get("email"), name=full_name
    )
    return auth_service.issue_tokens(user)


@router.post("/refresh", response_model=TokenPairOut)
async def refresh_token(refresh_token: str, db: AsyncSession = Depends(get_db)):
    return await auth_service.refresh_token_pair(db, refresh_token)
