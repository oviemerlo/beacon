"""TikTok oEmbed — no auth."""

from __future__ import annotations

import logging
from urllib.parse import quote

from app.services.link_preview import generic
from app.services.link_preview.result import LinkPreviewResult

logger = logging.getLogger(__name__)


async def fetch(url: str, *, normalized_url: str) -> LinkPreviewResult:
    oembed_url = f"https://www.tiktok.com/oembed?url={quote(url, safe='')}"
    try:
        payload = await generic.request_json(oembed_url, user_agent=generic.BROWSER_USER_AGENT)
        if payload:
            title = (payload.get("title") or "").strip() or None
            author = (payload.get("author_name") or "").strip() or None
            result = LinkPreviewResult.ok(
                normalized_url,
                title=title,
                description=author,
                image_url=(payload.get("thumbnail_url") or None),
                site_name=payload.get("provider_name") or "TikTok",
                favicon_url="https://www.tiktok.com/favicon.ico",
            )
            if result.status == "ok":
                return result
    except Exception as exc:
        logger.error("tiktok oembed failed for %s: %s", normalized_url, exc)
    return await generic.fetch(url, normalized_url=normalized_url)
