"""Link preview extraction and caching. Fail open — never block posts on fetch errors."""

from __future__ import annotations

import asyncio
import logging
import re
import time
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.repositories import link_preview_repository
from app.services.link_preview import facebook, generic, tiktok, twitter
from app.services.link_preview.result import LinkPreviewResult

logger = logging.getLogger(__name__)

URL_RE = re.compile(r"https?://[^\s<>\]\)\"']+", re.IGNORECASE)
TRACKING_PREFIXES = ("utm_",)
TRACKING_KEYS = {
    "fbclid",
    "gclid",
    "gclsrc",
    "dclid",
    "msclkid",
    "mc_eid",
    "igshid",
    "igsh",
    "twclid",
    "li_fat_id",
    "ref_src",
    "ref_url",
    "is_from_webapp",
    "sender_device",
    "share_app_id",
    "share_item_id",
    "share_link_id",
    "ttm_id",
    "_r",
}
TTL = timedelta(hours=24)
FAILED_TTL = timedelta(minutes=5)
TRAILING_PUNCT = ".,;:!?)\"'"
_recent_schedule: dict[str, float] = {}


def _is_tracking(key: str) -> bool:
    lowered = key.lower()
    return lowered in TRACKING_KEYS or any(lowered.startswith(prefix) for prefix in TRACKING_PREFIXES)


def normalize_url(url: str) -> str | None:
    raw = url.strip().rstrip(TRAILING_PUNCT)
    parts = urlsplit(raw)
    host = (parts.hostname or "").lower().rstrip(".")
    if parts.scheme not in ("http", "https") or not host:
        return None
    port = parts.port
    if port in (80, 443, None):
        netloc = host
    else:
        netloc = f"{host}:{port}"
    if host == "tiktok.com" or host.endswith(".tiktok.com"):
        query_pairs: list[tuple[str, str]] = []
    else:
        query_pairs = [(key, value) for key, value in parse_qsl(parts.query, keep_blank_values=True) if not _is_tracking(key)]
    path = parts.path or "/"
    return urlunsplit((parts.scheme.lower(), netloc, path, urlencode(query_pairs), ""))


def extract_urls(text: str) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for match in URL_RE.finditer(text or ""):
        normalized = normalize_url(match.group(0))
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        ordered.append(normalized)
    return ordered


def _host(url: str) -> str:
    return (urlsplit(url).hostname or "").lower()


def _fetcher(host: str):
    if host == "tiktok.com" or host.endswith(".tiktok.com"):
        return tiktok.fetch
    if host in {"twitter.com", "x.com", "t.co"} or host.endswith(".twitter.com") or host.endswith(".x.com"):
        return twitter.fetch
    if (
        host in {"facebook.com", "fb.com", "fb.watch"}
        or host.endswith(".facebook.com")
        or host.endswith(".fb.com")
    ):
        return facebook.fetch
    return generic.fetch


async def fetch_preview(url: str) -> LinkPreviewResult:
    normalized = normalize_url(url) or url
    try:
        return await _fetcher(_host(normalized))(normalized, normalized_url=normalized)
    except Exception as exc:
        logger.error("link preview fetch failed for %s: %s", normalized, exc)
        return LinkPreviewResult.failed(normalized)


def _fresh(fetched_at: datetime, status: str) -> bool:
    when = fetched_at if fetched_at.tzinfo else fetched_at.replace(tzinfo=timezone.utc)
    ttl = TTL if status == "ok" else FAILED_TTL
    return datetime.now(timezone.utc) - when < ttl


async def attach_previews(
    db: AsyncSession,
    text: str,
    *,
    broadcast_id: uuid.UUID | None = None,
    message_id: uuid.UUID | None = None,
) -> None:
    urls = extract_urls(text)
    if not urls:
        return
    now = datetime.now(timezone.utc)
    for index, url in enumerate(urls):
        existing = await link_preview_repository.get_by_normalized_url(db, url)
        if existing is not None and _fresh(existing.fetched_at, existing.status):
            row = existing
        else:
            result = await fetch_preview(url)
            row = await link_preview_repository.upsert(
                db,
                normalized_url=result.normalized_url,
                title=result.title,
                description=result.description,
                image_url=result.image_url,
                site_name=result.site_name,
                favicon_url=result.favicon_url,
                status=result.status,
                fetched_at=now,
            )
        if row.status != "ok":
            continue
        if broadcast_id is not None:
            await link_preview_repository.link_to_broadcast(db, broadcast_id, row.id, index)
        if message_id is not None:
            await link_preview_repository.link_to_message(db, message_id, row.id, index)


async def _run_in_background(text: str, broadcast_id: uuid.UUID | None, message_id: uuid.UUID | None) -> None:
    try:
        async with AsyncSessionLocal() as db:
            await attach_previews(db, text, broadcast_id=broadcast_id, message_id=message_id)
            await db.commit()
    except Exception as exc:
        logger.error("background link preview failed: %s", exc)


def schedule_previews(text: str, *, broadcast_id: uuid.UUID | None = None, message_id: uuid.UUID | None = None) -> None:
    if not extract_urls(text):
        return
    key = str(broadcast_id or message_id or text)
    now = time.monotonic()
    if now - _recent_schedule.get(key, 0) < 30:
        return
    _recent_schedule[key] = now
    try:
        asyncio.create_task(_run_in_background(text, broadcast_id, message_id))
    except RuntimeError:
        logger.error("no running loop for link preview task")
