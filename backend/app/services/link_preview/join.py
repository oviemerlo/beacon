"""First-party group-invite previews — built from the DB, not an HTTP fetch.

Generic OG scraping refuses loopback/private hosts (SSRF guard), so
localhost and same-origin /join/{token} links never unfurled. Invite
metadata is already in Postgres; read it directly.
"""

from __future__ import annotations

import re
from urllib.parse import urlsplit

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import conversation_repository
from app.services.link_preview.result import LinkPreviewResult
from app.utils.config import settings

JOIN_PATH_RE = re.compile(r"^/join/([A-Za-z0-9_-]+)/?$")


def _allowed_hosts() -> set[str]:
    hosts = {"localhost", "127.0.0.1"}
    frontend_host = (urlsplit(settings.FRONTEND_URL).hostname or "").lower()
    if frontend_host:
        hosts.add(frontend_host)
    return hosts


def invite_token_from_url(url: str) -> str | None:
    parts = urlsplit(url)
    host = (parts.hostname or "").lower()
    if host not in _allowed_hosts():
        return None
    match = JOIN_PATH_RE.match(parts.path or "")
    return match.group(1) if match else None


async def fetch(db: AsyncSession, normalized_url: str, token: str) -> LinkPreviewResult:
    invite = await conversation_repository.get_invite_by_token(db, token)
    if invite is None or invite.revoked_at is not None:
        return LinkPreviewResult.failed(normalized_url)
    conversation = await conversation_repository.get_by_id(db, invite.conversation_id)
    if conversation is None or not conversation.name:
        return LinkPreviewResult.failed(normalized_url)
    count = await conversation_repository.participant_count(db, conversation.id)
    if conversation.max_participants is not None:
        count_label = f"{count}/{conversation.max_participants} joined"
    else:
        count_label = f"{count} joined"
    description = invite.description.strip() if invite.description else None
    origin = settings.FRONTEND_URL.rstrip("/")
    return LinkPreviewResult.ok(
        normalized_url,
        title=conversation.name,
        description=description or f"Join this group chat · {count_label}",
        image_url=f"{origin}/og-share.png",
        site_name="EchoToCrowd",
        favicon_url=f"{origin}/echotocrowd-favicon.png",
    )
