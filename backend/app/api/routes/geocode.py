from fastapi import APIRouter, Depends, Request

from app.api.deps import get_current_user
from app.api.routes.search import limiter
from app.models.user import User
from app.services.geocoding_service import reverse_geocode

router = APIRouter(prefix="/geocode", tags=["geocode"])


@router.get("/reverse")
@limiter.limit("30/minute")
def reverse_geocode_label(
    request: Request, latitude: float, longitude: float, current_user: User = Depends(get_current_user)
):
    _ = request, current_user
    label = reverse_geocode(latitude, longitude)
    return {"label": label}
