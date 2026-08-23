"""
Runs daily (see app/main.py scheduler setup). Each user's 3-month window
starts on their own verified_at, so expiries are spread across the calendar
rather than synchronized. A quarterly cron would miss most users.

APScheduler in-process is fine to start with — swap for an Azure Function
timer trigger later without touching the service logic in
app/services/school_service.py.
"""

import logging

from app.db.session import AsyncSessionLocal
from app.services import school_service

logger = logging.getLogger("beacon.reverification")


async def run_daily_reverification_check() -> None:
    async with AsyncSessionLocal() as db:
        reminded = await school_service.send_reverification_reminders(db)
        expired = await school_service.expire_lapsed_verifications(db)
        logger.info("daily reverification check complete: %d reminders, %d expired", reminded, expired)
