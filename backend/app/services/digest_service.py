"""
Weekly digest — see docs/PRODUCT_BRIEF.md '§Why the digest is aggregate-
only'. Every field in DigestPayload is either a count or content the user
already had visibility into; nothing here is a new way to look someone up.
"""

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.config import settings
from app.models.user import User
from app.repositories import broadcast_repository, conversation_repository, user_repository

DIGEST_LOOKBACK_DAYS = 7
DIGEST_MATCH_RADIUS_METERS = 50_000  # metro-area cap for the "new matches" stat, not a user-tunable filter


@dataclass
class DigestPayload:
    user_id: uuid.UUID
    new_broadcast_count: int
    new_matches_count: int  # aggregate-only, see user_repository.count_users_sharing_tags_created_since
    unread_message_count: int
    top_broadcast_previews: list[str] = field(default_factory=list)


async def build_digest_for_user(db: AsyncSession, user: User) -> DigestPayload:
    feed_rows = await broadcast_repository.for_you_feed(db, user.id, limit=10, offset=0)
    since = user.last_digest_sent_at or (datetime.now(timezone.utc) - timedelta(days=DIGEST_LOOKBACK_DAYS))
    new_broadcasts = [b for b, _dist, _shared in feed_rows if b.created_at >= since]

    matches_count = await user_repository.count_users_sharing_tags_created_since(
        db, user.id, within_meters=DIGEST_MATCH_RADIUS_METERS, since_days=DIGEST_LOOKBACK_DAYS
    )
    unread_count = await conversation_repository.count_unread_for_user(db, user.id)

    return DigestPayload(
        user_id=user.id,
        new_broadcast_count=len(new_broadcasts),
        new_matches_count=matches_count,
        unread_message_count=unread_count,
        top_broadcast_previews=[b.content[:120] for b in new_broadcasts[:3]],
    )


def should_send_digest(payload: DigestPayload) -> bool:
    """Don't spam an empty digest — only send if there's something to say."""
    return payload.new_broadcast_count > 0 or payload.new_matches_count > 0 or payload.unread_message_count > 0


def render_digest_email(user: User, payload: DigestPayload) -> tuple[str, str]:
    """Returns (subject, html_body). Swap for a proper template engine later."""
    subject = f"{payload.new_broadcast_count + payload.new_matches_count} new things near you this week"
    lines = [f"<h2>Hi {user.display_name},</h2>"]
    if payload.new_matches_count:
        lines.append(f"<p><strong>{payload.new_matches_count} people</strong> who share your tags joined Beacon nearby this week.</p>")
    if payload.new_broadcast_count:
        lines.append(f"<p><strong>{payload.new_broadcast_count} new broadcasts</strong> landed in your feed:</p><ul>")
        lines.extend(f"<li>{preview}&hellip;</li>" for preview in payload.top_broadcast_previews)
        lines.append("</ul>")
    if payload.unread_message_count:
        lines.append(f"<p>You have <strong>{payload.unread_message_count} unread messages</strong> waiting.</p>")
    lines.append('<p><a href="https://app.beacon.example/feed">Open Beacon</a></p>')
    return subject, "\n".join(lines)


async def run_digest_for_all_users(db: AsyncSession, send_email_fn) -> int:
    """
    Orchestrates the full run: build → decide → send → mark sent, for every
    user. `send_email_fn` is injected so this stays testable without a real
    email provider — see app/jobs/digest_job.py for the production wiring.
    Returns the number of users evaluated.
    """
    users = await user_repository.list_all(db)

    for user in users:
        payload = await build_digest_for_user(db, user)
        if not should_send_digest(payload):
            continue

        subject, body = render_digest_email(user, payload)
        oauth_email = user.oauth_accounts[0].email if user.oauth_accounts else None
        if oauth_email:
            await send_email_fn(oauth_email, subject, body)

        await user_repository.set_last_digest_sent(db, user, datetime.now(timezone.utc))

    await db.commit()
    return len(users)
