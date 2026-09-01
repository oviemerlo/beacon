"""Facebook previews use facebookexternalhit so OG tags are returned."""

from __future__ import annotations

from app.services.link_preview import generic
from app.services.link_preview.result import LinkPreviewResult

FACEBOOK_USER_AGENT = "facebookexternalhit/1.1"


async def fetch(url: str, *, normalized_url: str) -> LinkPreviewResult:
    return await generic.fetch(url, user_agent=FACEBOOK_USER_AGENT, normalized_url=normalized_url)
