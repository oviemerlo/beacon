"""Parse and validate @username mentions against an echo's participant set."""

from __future__ import annotations

import re
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.repositories import conversation_repository
from app.services.exceptions import ValidationError

MENTION_RE = re.compile(r"(?<![A-Za-z0-9_])@([A-Za-z0-9._-]{1,50})")


def extract_mention_usernames(body: str) -> list[str]:
    seen: list[str] = []
    for match in MENTION_RE.finditer(body):
        username = match.group(1)
        key = username.lower()
        if key not in {item.lower() for item in seen}:
            seen.append(username)
    return seen


async def resolve_mentions(db: AsyncSession, usernames: list[str]) -> dict[str, User]:
    if not usernames:
        return {}
    lowered = [name.lower() for name in usernames]
    result = await db.execute(select(User).where(func.lower(User.username).in_(lowered)))
    return {user.username.lower(): user for user in result.scalars().all()}


async def validate_mentions_for_echo(
    db: AsyncSession,
    body: str,
    root_echo_id: uuid.UUID,
    sender_id: uuid.UUID,
) -> list[uuid.UUID]:
    usernames = extract_mention_usernames(body)
    if not usernames:
        return []

    resolved = await resolve_mentions(db, usernames)
    participant_ids = set(await conversation_repository.list_echo_participant_ids(db, root_echo_id))
    invalid: list[str] = []
    mentioned: list[uuid.UUID] = []
    for username in usernames:
        user = resolved.get(username.lower())
        if user is None:
            continue
        if user.id not in participant_ids:
            invalid.append(f"@{user.username}")
            continue
        if user.id != sender_id and user.id not in mentioned:
            mentioned.append(user.id)

    if invalid:
        names = ", ".join(invalid)
        raise ValidationError(
            f"{names} {'is' if len(invalid) == 1 else 'are'} not part of this Echo's thread, so they can't be mentioned."
        )
    return mentioned
