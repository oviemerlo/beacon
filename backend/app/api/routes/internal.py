from fastapi import APIRouter, Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_internal_secret
from app.db.session import get_db
from app.jobs.digest_job import run_weekly_digest
from app.jobs.reverification_job import run_daily_reverification_check
from app.schemas.schemas import GuardDutyScanResultIn
from app.services import upload_service
from app.utils.config import settings

router = APIRouter(prefix="/internal", include_in_schema=False)


@router.post("/jobs/run-digest-now")
async def trigger_digest_manually(x_internal_job_token: str | None = Header(default=None)):
    """
    Manual trigger for local testing/ops. Previously had no auth at all —
    anyone who could reach the API could force a full digest run (email
    volume / cost abuse, or just repeated spam to every user). Now requires
    a header matching INTERNAL_JOB_TOKEN; with that setting unset (the
    default), no header value can match and the route always 403s.
    """
    require_internal_secret(x_internal_job_token, settings.INTERNAL_JOB_TOKEN)
    await run_weekly_digest()
    return {"status": "digest run triggered"}


@router.post("/jobs/run-reverification-now")
async def trigger_reverification_manually(x_internal_job_token: str | None = Header(default=None)):
    """
    Manual trigger for local testing/ops. Same token gate as the digest job:
    requires x-internal-job-token matching INTERNAL_JOB_TOKEN. With that
    setting unset, no header value can match and the route always 403s.
    """
    require_internal_secret(x_internal_job_token, settings.INTERNAL_JOB_TOKEN)
    await run_daily_reverification_check()
    return {"status": "reverification run triggered"}


@router.post("/uploads/scan-result")
async def guardduty_scan_result(
    payload: GuardDutyScanResultIn,
    db: AsyncSession = Depends(get_db),
    x_internal_webhook_secret: str | None = Header(default=None),
):
    require_internal_secret(x_internal_webhook_secret, settings.INTERNAL_WEBHOOK_SECRET)
    await upload_service.handle_scan_result_webhook(
        db,
        bucket=payload.bucket,
        s3_key=payload.s3_key,
        scan_status=payload.scan_status,
        raw_guardduty_status=payload.raw_guardduty_status,
    )
    return {"status": "ok"}
