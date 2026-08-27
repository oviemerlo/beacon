import html
import logging
from functools import lru_cache

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from app.utils.config import settings

logger = logging.getLogger(__name__)


class EmailDeliveryError(Exception):
    """SES (or local fallback) could not deliver mail."""


def _ses_configured() -> bool:
    return bool(settings.AWS_REGION and settings.SES_FROM_EMAIL)


@lru_cache(maxsize=1)
def _ses_client():
    kwargs: dict = {"region_name": settings.AWS_REGION}
    if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
        kwargs["aws_access_key_id"] = settings.AWS_ACCESS_KEY_ID
        kwargs["aws_secret_access_key"] = settings.AWS_SECRET_ACCESS_KEY
    return boto3.client("ses", **kwargs)


def _send_ses_email(*, to_email: str, subject: str, body: str, html_body: str | None = None) -> None:
    message_body = {"Text": {"Data": body}}
    if html_body:
        message_body["Html"] = {"Data": html_body}

    try:
        _ses_client().send_email(
            Source=settings.SES_FROM_EMAIL,
            Destination={"ToAddresses": [to_email]},
            Message={
                "Subject": {"Data": subject},
                "Body": message_body,
            },
        )
    except (ClientError, BotoCoreError) as exc:
        code = "unknown"
        message = str(exc)
        if isinstance(exc, ClientError):
            error = exc.response.get("Error") or {}
            code = error.get("Code") or code
            message = error.get("Message") or message
        logger.error("SES send failed: %s - %s", code, message)
        raise EmailDeliveryError("Couldn't send email") from exc


def send_otp_email(to_email: str, code: str) -> None:
    if not _ses_configured():
        if settings.ENVIRONMENT == "development":
            logger.info("School OTP to %s: %s", to_email, code)
            return
        raise EmailDeliveryError("Email delivery is not configured for this environment")

    text_body = (
        f"Your EchoToCrowd verification code is: {code}. "
        "This code expires in 10 minutes. "
        "If you did not request this code, you can safely ignore this email."
    )
    html_body = f"""
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto;">
        <p>Your EchoToCrowd verification code is:</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 4px; margin: 16px 0;">
            {html.escape(code)}
        </p>
        <p style="color: #666; font-size: 14px;">
            This code expires in 10 minutes. If you did not request this code,
            you can safely ignore this email.
        </p>
    </div>
    """

    _send_ses_email(
        to_email=to_email,
        subject="Your EchoToCrowd verification code",
        body=text_body,
        html_body=html_body,
    )


def send_reverification_reminder_email(to_email: str, school_name: str, expires_at) -> None:
    expires_label = expires_at.isoformat() if hasattr(expires_at, "isoformat") else str(expires_at)
    if not _ses_configured():
        if settings.ENVIRONMENT == "development":
            logger.info(
                "School reverification reminder to %s school=%s expires_at=%s",
                to_email,
                school_name,
                expires_label,
            )
            return
        raise EmailDeliveryError("Email delivery is not configured for this environment")

    text_body = (
        f"Your EchoToCrowd student verification for {school_name} expires on {expires_label}. "
        "Open the app and confirm your school email again to stay verified. "
        "If you did not verify a school on EchoToCrowd, you can ignore this email."
    )
    html_body = f"""
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto;">
        <p>Your EchoToCrowd student verification for <strong>{html.escape(school_name)}</strong>
        expires on {html.escape(expires_label)}.</p>
        <p>Open the app and confirm your school email again to stay verified.</p>
        <p style="color: #666; font-size: 14px;">
            If you did not verify a school on EchoToCrowd, you can ignore this email.
        </p>
    </div>
    """

    _send_ses_email(
        to_email=to_email,
        subject="Reconfirm your EchoToCrowd school verification",
        body=text_body,
        html_body=html_body,
    )

