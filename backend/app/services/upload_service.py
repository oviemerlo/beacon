"""Avatar and Echo attachment uploads: validate, compress, store, serve."""

from __future__ import annotations

import io
import logging
import os
import re
import unicodedata
import uuid
import zipfile
from functools import lru_cache
from urllib.parse import unquote

import boto3
import filetype
from botocore.exceptions import BotoCoreError, ClientError
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.upload import UploadedFile
from app.models.user import User
from app.repositories import broadcast_repository, upload_repository
from app.services.exceptions import ForbiddenError, NotFoundError, ValidationError
from app.services.user_service import can_attach_files
from app.utils.config import settings

logger = logging.getLogger(__name__)

ALLOWED_AVATAR_TYPES = {"image/jpeg", "image/png"}
ALLOWED_ATTACHMENT_TYPES = {
    "image/jpeg",
    "image/png",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
IMAGE_TYPES = {"image/jpeg", "image/png"}
MAX_IMAGE_DIMENSION = 2048
JPEG_QUALITY = 80
PRESIGNED_URL_EXPIRES_IN = 900
SCAN_STATUS_CLEAN = "clean"
SCAN_STATUS_INFECTED = "infected"
SCAN_STATUS_FAILED = "scan_failed"

GUARDDUTY_STATUS_MAP = {
    "NO_THREATS_FOUND": SCAN_STATUS_CLEAN,
    "THREATS_FOUND": SCAN_STATUS_INFECTED,
    "UNSUPPORTED": SCAN_STATUS_FAILED,
    "ACCESS_DENIED": SCAN_STATUS_FAILED,
    "FAILED": SCAN_STATUS_FAILED,
    "pending": "pending",
    "clean": SCAN_STATUS_CLEAN,
    "infected": SCAN_STATUS_INFECTED,
    "scan_failed": SCAN_STATUS_FAILED,
}


def _detect_content_type(file_bytes: bytes) -> str:
    """Magic-byte detection — never trust the client's Content-Type or extension."""
    kind = filetype.guess(file_bytes)
    if kind is not None:
        mime = kind.mime
        if mime in ALLOWED_AVATAR_TYPES | ALLOWED_ATTACHMENT_TYPES:
            return mime
        if mime == "application/zip":
            office = _office_mime_from_zip(file_bytes)
            if office is not None:
                return office
    office = _office_mime_from_zip(file_bytes)
    if office is not None:
        return office
    raise ValidationError("Unsupported file type")


def _office_mime_from_zip(file_bytes: bytes) -> str | None:
    if len(file_bytes) < 4 or file_bytes[:2] != b"PK":
        return None
    try:
        with zipfile.ZipFile(io.BytesIO(file_bytes)) as archive:
            names = archive.namelist()
    except zipfile.BadZipFile:
        return None
    if any(name.startswith("word/") for name in names):
        return DOCX_MIME
    if any(name.startswith("xl/") for name in names):
        return XLSX_MIME
    return None


def _sanitize_filename(name: str) -> str:
    cleaned = unicodedata.normalize("NFKC", name.replace("\x00", ""))
    cleaned = cleaned.replace("\\", "/")
    cleaned = os.path.basename(cleaned)
    cleaned = "".join(ch for ch in cleaned if ch.isprintable())
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", cleaned).strip("._")
    if not cleaned:
        cleaned = "file"
    return cleaned[:200]


def _filename_for_type(sanitized: str, content_type: str) -> str:
    extensions = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "application/pdf": ".pdf",
        DOCX_MIME: ".docx",
        XLSX_MIME: ".xlsx",
    }
    expected = extensions.get(content_type, "")
    stem, ext = os.path.splitext(sanitized)
    if expected and ext.lower() != expected:
        return f"{stem or 'file'}{expected}"
    return sanitized


def _process_image(file_bytes: bytes) -> bytes:
    try:
        with Image.open(io.BytesIO(file_bytes)) as original:
            original = ImageOps.exif_transpose(original) or original
            source_format = (original.format or "JPEG").upper()
            preserve_png = source_format == "PNG"
            working = original.copy()
    except UnidentifiedImageError as exc:
        raise ValidationError("Could not read this image") from exc
    except OSError as exc:
        raise ValidationError("Could not read this image") from exc

    if preserve_png:
        if working.mode not in ("RGB", "RGBA"):
            working = working.convert("RGBA") if "A" in working.mode else working.convert("RGB")
    else:
        if working.mode not in ("RGB", "L"):
            working = working.convert("RGB")

    longest = max(working.size)
    if longest > MAX_IMAGE_DIMENSION:
        ratio = MAX_IMAGE_DIMENSION / longest
        working = working.resize(
            (max(1, int(working.width * ratio)), max(1, int(working.height * ratio))),
            Image.Resampling.LANCZOS,
        )

    # New image from pixel data only — drops EXIF/GPS and any other info dict.
    clean = Image.new(working.mode, working.size)
    clean.putdata(list(working.getdata()))

    output = io.BytesIO()
    if preserve_png:
        clean.save(output, format="PNG", optimize=True)
    else:
        clean.save(output, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    return output.getvalue()


def _s3_configured() -> bool:
    return bool(settings.S3_ACCESS_KEY_ID and settings.S3_SECRET_ACCESS_KEY and settings.S3_BUCKET_NAME)


@lru_cache(maxsize=1)
def _s3_client():
    """Separate client from SES — uses the s3-uploads-service IAM user."""
    return boto3.client(
        "s3",
        region_name=settings.S3_REGION,
        aws_access_key_id=settings.S3_ACCESS_KEY_ID,
        aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
    )


def _put_object(*, s3_key: str, body: bytes, content_type: str) -> None:
    if not _s3_configured():
        raise ValidationError("File storage is not configured")
    try:
        _s3_client().put_object(
            Bucket=settings.S3_BUCKET_NAME,
            Key=s3_key,
            Body=body,
            ContentType=content_type,
        )
    except (ClientError, BotoCoreError) as exc:
        logger.error("S3 put_object failed: %s", exc)
        raise ValidationError("Couldn't store this file") from exc


def _delete_object(s3_key: str) -> None:
    if not _s3_configured():
        return
    try:
        _s3_client().delete_object(Bucket=settings.S3_BUCKET_NAME, Key=s3_key)
    except (ClientError, BotoCoreError) as exc:
        logger.error("S3 delete_object failed for %s: %s", s3_key, exc)


def _map_scan_status(raw: str) -> str:
    token = raw.strip()
    mapped = (
        GUARDDUTY_STATUS_MAP.get(token)
        or GUARDDUTY_STATUS_MAP.get(token.upper())
        or GUARDDUTY_STATUS_MAP.get(token.lower())
    )
    if mapped is None:
        raise ValidationError("Unknown scan status")
    return mapped


def _resolve_scan_status(scan_status: str, raw_guardduty_status: str | None) -> str:
    try:
        return _map_scan_status(scan_status)
    except ValidationError:
        if raw_guardduty_status:
            return _map_scan_status(raw_guardduty_status)
        raise


async def _store_upload(
    db: AsyncSession,
    *,
    user: User,
    context: str,
    broadcast_id: uuid.UUID | None,
    file_bytes: bytes,
    declared_filename: str,
    allowed_types: set[str],
    max_bytes: int,
    s3_key: str,
) -> UploadedFile:
    if not file_bytes:
        raise ValidationError("File is empty")
    if len(file_bytes) > max_bytes:
        raise ValidationError("File is too large")

    content_type = _detect_content_type(file_bytes)
    if content_type not in allowed_types:
        raise ValidationError("Unsupported file type")

    stored_bytes = _process_image(file_bytes) if content_type in IMAGE_TYPES else file_bytes
    stored_type = "image/png" if content_type == "image/png" else content_type
    if content_type == "image/jpeg":
        stored_type = "image/jpeg"

    filename = _filename_for_type(_sanitize_filename(declared_filename), stored_type)
    # Never use the raw client filename as the S3 key; uuid prefix is the identity.
    key = s3_key.rsplit("/", 1)[0] + "/" + filename
    _put_object(s3_key=key, body=stored_bytes, content_type=stored_type)
    row = await upload_repository.create(
        db,
        uploader_user_id=user.id,
        context=context,
        broadcast_id=broadcast_id,
        s3_key=key,
        original_filename=filename,
        content_type=stored_type,
        size_bytes=len(stored_bytes),
    )
    # GuardDuty's Lambda is a log-only stub on localhost, so local uploads
    # would stay pending forever. Production waits for the scan webhook.
    if settings.ENVIRONMENT == "development":
        row.scan_status = SCAN_STATUS_CLEAN
    await db.commit()
    return row


async def upload_avatar(db: AsyncSession, user: User, file_bytes: bytes, declared_filename: str) -> UploadedFile:
    # Replacing an avatar leaves the previous S3 object in place (orphaned).
    # Cleaning those up after the new object is confirmed clean is a v1
    # storage-cost tradeoff — skip deletion here rather than race GuardDuty.
    return await _store_upload(
        db,
        user=user,
        context="avatar",
        broadcast_id=None,
        file_bytes=file_bytes,
        declared_filename=declared_filename,
        allowed_types=ALLOWED_AVATAR_TYPES,
        max_bytes=settings.MAX_IMAGE_UPLOAD_BYTES,
        s3_key=f"avatar/{uuid.uuid4()}/placeholder",
    )


async def upload_broadcast_attachment(
    db: AsyncSession,
    user: User,
    broadcast_id: uuid.UUID | str,
    file_bytes: bytes,
    declared_filename: str,
) -> UploadedFile:
    if not can_attach_files(user):
        raise ForbiddenError("Verify your account to attach files to broadcasts")

    broadcast = await broadcast_repository.get_by_id(db, broadcast_id)
    if broadcast is None or broadcast.deleted_at is not None:
        raise NotFoundError("Broadcast not found")
    if broadcast.sender_id != user.id:
        raise ForbiddenError("You can only attach files to your own Echoes")

    return await _store_upload(
        db,
        user=user,
        context="broadcast_attachment",
        broadcast_id=broadcast.id,
        file_bytes=file_bytes,
        declared_filename=declared_filename,
        allowed_types=ALLOWED_ATTACHMENT_TYPES,
        max_bytes=settings.MAX_DOCUMENT_UPLOAD_BYTES,
        s3_key=f"broadcast_attachment/{broadcast.id}/{uuid.uuid4()}/placeholder",
    )


async def get_presigned_url(db: AsyncSession, user: User, file_id: uuid.UUID | str) -> str:
    _ = user
    row = await upload_repository.get_by_id(db, file_id)
    if row is None:
        raise NotFoundError("File not found")
    if row.scan_status != SCAN_STATUS_CLEAN:
        raise ValidationError("This file is not available yet.")
    if not _s3_configured():
        raise ValidationError("File storage is not configured")
    try:
        return _s3_client().generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.S3_BUCKET_NAME, "Key": row.s3_key},
            ExpiresIn=PRESIGNED_URL_EXPIRES_IN,
        )
    except (ClientError, BotoCoreError) as exc:
        logger.error("S3 presign failed: %s", exc)
        raise ValidationError("Couldn't generate a download link") from exc


async def handle_scan_result_webhook(
    db: AsyncSession,
    *,
    bucket: str,
    s3_key: str,
    scan_status: str,
    raw_guardduty_status: str | None = None,
) -> None:
    if bucket != settings.S3_BUCKET_NAME:
        raise NotFoundError("File not found")
    key = unquote(s3_key)
    row = await upload_repository.get_by_s3_key(db, bucket, key)
    if row is None:
        raise NotFoundError("File not found")

    mapped = _resolve_scan_status(scan_status, raw_guardduty_status)
    if mapped == SCAN_STATUS_INFECTED:
        _delete_object(row.s3_key)
        logger.warning(
            "Deleted infected S3 object %s (file_id=%s, guardduty=%s)",
            row.s3_key,
            row.id,
            raw_guardduty_status,
        )

    await upload_repository.update_scan_status(db, row.id, mapped)
    await db.commit()
