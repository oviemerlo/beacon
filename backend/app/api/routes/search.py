from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.schemas import PublicProfileOut
from app.services import search_service

router = APIRouter(prefix="/search", tags=["search"])
limiter = Limiter(key_func=get_remote_address)


@router.get("/users", response_model=list[PublicProfileOut])
@limiter.limit("20/hour")
async def search_users(request: Request, q: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """
    Exact/prefix username match ONLY — see docs/PRODUCT_BRIEF.md '§Search'.
    Results never unlock messaging; that still requires a valid broadcast
    impression, enforced in conversation_service.
    """
    return await search_service.search_usernames(db, q)
