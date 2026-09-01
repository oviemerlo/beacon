"""Twitter/X oEmbed, then generic fetch as Twitterbot."""

from __future__ import annotations

import logging
import re
from urllib.parse import quote

from app.services.link_preview import generic
from app.services.link_preview.result import LinkPreviewResult

logger = logging.getLogger(__name__)

TWITTERBOT = "Twitterbot/1.0"
HTML_TITLE_RE = re.compile(r"<[^>]+>")


async def fetch(url: str, *, normalized_url: str) -> LinkPreviewResult:
    oembed_url = f"https://publish.twitter.com/oembed?url={quote(url, safe='')}"
    try:
        payload = await generic.request_json(oembed_url, user_agent=generic.BROWSER_USER_AGENT)
        if payload:
            html = payload.get("html") or ""
            text = HTML_TITLE_RE.sub(" ", html)
            text = " ".join(text.split()).strip() or None
            author = (payload.get("author_name") or "").strip() or None
            return LinkPreviewResult.ok(
                normalized_url,
                title=author,
                description=text,
                site_name=payload.get("provider_name") or "X",
                favicon_url="https://abs.twimg.com/favicons/twitter.3.ico",
            )
    except Exception as exc:
        logger.error("twitter oembed failed for %s: %s", normalized_url, exc)
    return await generic.fetch(url, user_agent=TWITTERBOT, normalized_url=normalized_url)
