"""AWS Rekognition image moderation. Fail open — never block an upload."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from functools import lru_cache

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from app.utils.config import settings

logger = logging.getLogger(__name__)

REKOGNITION_BYTES_MAX = 5 * 1024 * 1024


@dataclass(frozen=True)
class ModerationResult:
    decision: str
    top_label: str | None
    confidence: float | None
    raw_labels_json: str | None


def _rekognition_configured() -> bool:
    return bool(settings.AWS_REKOGNITION_ACCESS_KEY_ID and settings.AWS_REKOGNITION_SECRET_ACCESS_KEY)


@lru_cache(maxsize=1)
def _rekognition_client():
    """Separate client from SES/S3 — uses the Rekognition-only IAM user."""
    return boto3.client(
        "rekognition",
        region_name=settings.AWS_REKOGNITION_REGION,
        aws_access_key_id=settings.AWS_REKOGNITION_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_REKOGNITION_SECRET_ACCESS_KEY,
    )


def _clean(*, raw_labels_json: str | None = None) -> ModerationResult:
    return ModerationResult("clean", None, None, raw_labels_json)


def moderate_image_bytes(image_bytes: bytes) -> ModerationResult:
    if not _rekognition_configured():
        logger.error("Rekognition credentials missing; failing open as clean")
        return _clean()
    if len(image_bytes) > REKOGNITION_BYTES_MAX:
        logger.warning(
            "Skipping Rekognition: image is %s bytes (cap %s)",
            len(image_bytes),
            REKOGNITION_BYTES_MAX,
        )
        return _clean()

    try:
        response = _rekognition_client().detect_moderation_labels(
            Image={"Bytes": image_bytes},
            MinConfidence=settings.MODERATION_FLAG_CONFIDENCE,
        )
    except (ClientError, BotoCoreError) as exc:
        logger.error("Rekognition detect_moderation_labels failed: %s", exc)
        return _clean()

    labels = response.get("ModerationLabels") or []
    raw = json.dumps(labels)
    if not labels:
        return _clean(raw_labels_json=raw)

    top = max(labels, key=lambda item: float(item.get("Confidence") or 0))
    top_label = top.get("Name")
    confidence = float(top.get("Confidence") or 0)
    if confidence >= settings.MODERATION_REJECT_CONFIDENCE:
        decision = "reject"
    elif confidence >= settings.MODERATION_FLAG_CONFIDENCE:
        decision = "flag"
    else:
        decision = "clean"
    return ModerationResult(decision, top_label, confidence, raw)
