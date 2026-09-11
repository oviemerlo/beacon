"""Scratch SES check. Run from backend/: python -m app.services.test_ses"""

import logging

from app.utils.config import settings
from app.utils.email import EmailDeliveryError, send_otp_email

logging.basicConfig(level=logging.INFO)

print("AWS_REGION set:", bool(settings.AWS_REGION))
print("SES_FROM_EMAIL set:", bool(settings.SES_FROM_EMAIL))

try:
    send_otp_email("oviemerlo@gmail.com", "123456")
except EmailDeliveryError as exc:
    print(f"Failed: {exc}")
else:
    if settings.AWS_REGION and settings.SES_FROM_EMAIL:
        print("Sent via SES.")
    else:
        print("Logged locally — SES is not configured (need AWS_REGION and SES_FROM_EMAIL).")
