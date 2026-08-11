from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin_user, get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.schemas import ReportCreateIn, ReportOut, ReportQueueItemOut, ReportResolveIn
from app.services import report_service

router = APIRouter(prefix="/reports", tags=["reports"])


@router.post("", response_model=ReportOut, status_code=201)
async def create_report(
    payload: ReportCreateIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await report_service.create_report(
        db,
        reporter_id=current_user.id,
        target_type=payload.target_type,
        target_id=payload.target_id,
        reason=payload.reason,
        details=payload.details,
    )


@router.get("", response_model=list[ReportQueueItemOut])
async def list_reports(
    status: str = Query(default="pending", pattern="^(pending|dismissed|actioned)$"),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    return await report_service.list_reports_for_queue(db, status=status, limit=limit, offset=offset)


@router.post("/{report_id}/resolve", response_model=ReportOut)
async def resolve_report(
    report_id: str,
    payload: ReportResolveIn,
    current_admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    return await report_service.resolve_report(
        db,
        report_id=report_id,
        action=payload.action,
        resolution_notes=payload.resolution_notes,
        admin_user_id=current_admin.id,
    )
