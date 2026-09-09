from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.schemas import PublicProfileOut
from app.services import search_service
from app.utils.rate_limit import limiter

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/users", response_model=list[PublicProfileOut])
@limiter.limit("20/hour")
async def search_users(request: Request, q: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """
    Exact/prefix username match ONLY — see docs/PRODUCT_BRIEF.md '§Search'.
    Results never unlock messaging; that still requires a valid broadcast
    impression, enforced in conversation_service.
    """
    return await search_service.search_usernames(db, q)
