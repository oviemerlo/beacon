import logging

from app.utils.config import settings

logger = logging.getLogger(__name__)


def send_otp_email(to_email: str, code: str) -> None:
    if settings.ENVIRONMENT == "development":
        logger.info("School OTP to %s: %s", to_email, code)
        return

    # TODO: Wire real email delivery provider (SendGrid/Postmark/SES) before production use.
    raise NotImplementedError("Email delivery is not configured for this environment")
