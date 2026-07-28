"""
Runs weekly (see app/main.py scheduler setup). In production this would be
better suited to an Azure Function on a timer trigger, or a Celery/arq beat
task — APScheduler in-process is fine to start with and easy to swap out
later without touching the digest logic itself, which now lives entirely
in app/services/digest_service.py.
"""

import logging

from app.db.session import AsyncSessionLocal
from app.services.digest_service import run_digest_for_all_users

logger = logging.getLogger("beacon.digest")


async def send_email(to_address: str, subject: str, html_body: str) -> None:
    # Wire up to your transactional email provider (SES, Postmark, SendGrid...).
    logger.info("digest email queued to=%s subject=%s", to_address, subject)


async def run_weekly_digest() -> None:
    async with AsyncSessionLocal() as db:
        evaluated = await run_digest_for_all_users(db, send_email)
        logger.info("weekly digest run complete: %d users evaluated", evaluated)
