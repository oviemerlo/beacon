"""Feed-history search: the viewer's received broadcasts + DMs spawned from them."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy import String, func, literal, or_, select, union, union_all
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased, selectinload

from app.models.broadcast import Broadcast, BroadcastImpression, BroadcastTag, HiddenBroadcast
from app.models.conversation import BlockedUser, Conversation, Message
from app.models.user import User
from app.repositories.broadcast_repository import selected_audience_matches


@dataclass
class NestedSearchMatch:
    id: uuid.UUID
    body: str
    created_at: datetime
    source: str
    conversation_id: uuid.UUID | None = None
    sender_display_name: str = "Unknown"
    sender_id: uuid.UUID | None = None


@dataclass
class FeedHistoryHit:
    broadcast: Broadcast
    match_type: str
    matches: list[NestedSearchMatch] = field(default_factory=list)


def _hidden_broadcast_ids(user_id: uuid.UUID):
    return select(HiddenBroadcast.broadcast_id).where(HiddenBroadcast.user_id == user_id)


def _received_echo_ids(user_id: uuid.UUID):
    hidden = _hidden_broadcast_ids(user_id)
    root_id = func.coalesce(Broadcast.parent_broadcast_id, Broadcast.id)
    impressions = (
        select(root_id.label("echo_id"))
        .select_from(BroadcastImpression)
        .join(Broadcast, Broadcast.id == BroadcastImpression.broadcast_id)
        .where(BroadcastImpression.viewer_id == user_id)
        .where(Broadcast.deleted_at.is_(None))
        .where(root_id.not_in(hidden))
    )
    own_roots = select(Broadcast.id.label("echo_id")).where(
        Broadcast.sender_id == user_id,
        Broadcast.parent_broadcast_id.is_(None),
        Broadcast.id.not_in(hidden),
    )
    return union(impressions, own_roots).cte("received")


def _tag_filter(echo_id_col, tag_ids: list[int]):
    """Optional additive filter: skip entirely when no tags are selected."""
    return selected_audience_matches(echo_id_col, tag_ids)


def _blocked_sender_ids(user_id: uuid.UUID):
    return select(BlockedUser.blocked_id).where(BlockedUser.blocker_id == user_id)


async def search_history(
    db: AsyncSession,
    user_id: uuid.UUID,
    query: str,
    tag_ids: list[int],
    limit: int = 50,
) -> list[FeedHistoryHit]:
    tsquery = func.plainto_tsquery("english", query)
    received = _received_echo_ids(user_id)
    blocked = _blocked_sender_ids(user_id)
    origin = aliased(Broadcast)
    root_id = func.coalesce(origin.parent_broadcast_id, origin.id)

    echo_stmt = (
        select(
            Broadcast.id.label("echo_id"),
            Broadcast.created_at.label("matched_at"),
            literal("echo", String).label("kind"),
        )
        .where(Broadcast.id.in_(select(received.c.echo_id)))
        .where(Broadcast.deleted_at.is_(None))
        .where(Broadcast.parent_broadcast_id.is_(None))
        .where(Broadcast.sender_id.not_in(blocked))
        .where(Broadcast.search_vector.op("@@")(tsquery))
    )
    echo_tag = _tag_filter(Broadcast.id, tag_ids)
    if echo_tag is not None:
        echo_stmt = echo_stmt.where(echo_tag)

    reply_stmt = (
        select(
            Broadcast.parent_broadcast_id.label("echo_id"),
            Broadcast.created_at.label("matched_at"),
            literal("message", String).label("kind"),
        )
        .where(Broadcast.parent_broadcast_id.in_(select(received.c.echo_id)))
        .where(Broadcast.deleted_at.is_(None))
        .where(Broadcast.sender_id.not_in(blocked))
        .where(Broadcast.search_vector.op("@@")(tsquery))
    )
    reply_tag = _tag_filter(Broadcast.parent_broadcast_id, tag_ids)
    if reply_tag is not None:
        reply_stmt = reply_stmt.where(reply_tag)

    message_stmt = (
        select(
            root_id.label("echo_id"),
            Message.sent_at.label("matched_at"),
            literal("message", String).label("kind"),
        )
        .select_from(Message)
        .join(Conversation, Conversation.id == Message.conversation_id)
        .join(origin, origin.id == Conversation.origin_broadcast_id)
        .where(or_(Conversation.initiator_id == user_id, Conversation.recipient_id == user_id))
        .where(root_id.in_(select(received.c.echo_id)))
        .where(origin.deleted_at.is_(None))
        .where(origin.sender_id.not_in(blocked))
        .where(Message.search_vector.op("@@")(tsquery))
    )
    message_tag = _tag_filter(root_id, tag_ids)
    if message_tag is not None:
        message_stmt = message_stmt.where(message_tag)

    combined = union_all(echo_stmt, reply_stmt, message_stmt).subquery("matches")
    ranked_stmt = (
        select(
            combined.c.echo_id,
            func.max(combined.c.matched_at).label("latest_match_at"),
        )
        .group_by(combined.c.echo_id)
        .order_by(func.max(combined.c.matched_at).desc())
        .limit(limit)
    )
    ranked_rows = (await db.execute(ranked_stmt)).all()
    if not ranked_rows:
        return []

    echo_ids = [row.echo_id for row in ranked_rows]
    latest_by_id = {row.echo_id: row.latest_match_at for row in ranked_rows}

    broadcasts_stmt = (
        select(Broadcast)
        .options(selectinload(Broadcast.sender), selectinload(Broadcast.tags).selectinload(BroadcastTag.tag))
        .where(Broadcast.id.in_(echo_ids))
        .where(Broadcast.deleted_at.is_(None))
    )
    broadcasts = {b.id: b for b in (await db.execute(broadcasts_stmt)).scalars().all()}

    echo_match_rows = (await db.execute(echo_stmt.where(Broadcast.id.in_(echo_ids)))).all()
    echo_match_ids = {row.echo_id for row in echo_match_rows}

    reply_rows = (
        await db.execute(
            select(Broadcast)
            .options(selectinload(Broadcast.sender))
            .where(Broadcast.parent_broadcast_id.in_(echo_ids))
            .where(Broadcast.deleted_at.is_(None))
            .where(Broadcast.sender_id.not_in(blocked))
            .where(Broadcast.id.not_in(_hidden_broadcast_ids(user_id)))
            .where(Broadcast.search_vector.op("@@")(tsquery))
            .order_by(Broadcast.created_at.desc())
        )
    ).scalars().all()

    message_rows = (
        await db.execute(
            select(Message, Conversation, origin, User)
            .join(Conversation, Conversation.id == Message.conversation_id)
            .join(origin, origin.id == Conversation.origin_broadcast_id)
            .join(User, User.id == Message.sender_id)
            .where(or_(Conversation.initiator_id == user_id, Conversation.recipient_id == user_id))
            .where(root_id.in_(echo_ids))
            .where(Message.search_vector.op("@@")(tsquery))
            .order_by(Message.sent_at.desc())
        )
    ).all()

    nested: dict[uuid.UUID, list[NestedSearchMatch]] = {echo_id: [] for echo_id in echo_ids}
    for reply in reply_rows:
        parent_id = reply.parent_broadcast_id
        if parent_id is None or parent_id not in nested:
            continue
        nested[parent_id].append(
            NestedSearchMatch(
                id=reply.id,
                body=reply.content,
                created_at=reply.created_at,
                source="reply",
                sender_display_name=reply.sender.display_name if reply.sender is not None else "Unknown",
                sender_id=reply.sender_id,
            )
        )
    for message, conversation, origin_broadcast, sender in message_rows:
        echo_id = origin_broadcast.parent_broadcast_id or origin_broadcast.id
        if echo_id not in nested:
            continue
        nested[echo_id].append(
            NestedSearchMatch(
                id=message.id,
                body=message.body,
                created_at=message.sent_at,
                source="message",
                conversation_id=conversation.id,
                sender_display_name=sender.display_name if sender is not None else "Unknown",
                sender_id=message.sender_id,
            )
        )

    hits: list[FeedHistoryHit] = []
    for echo_id in echo_ids:
        broadcast = broadcasts.get(echo_id)
        if broadcast is None:
            continue
        matches = nested.get(echo_id, [])
        if echo_id in echo_match_ids and matches:
            match_type = "both"
        elif echo_id in echo_match_ids:
            match_type = "echo"
        else:
            match_type = "message"
        matches.sort(key=lambda item: item.created_at, reverse=True)
        hits.append(FeedHistoryHit(broadcast=broadcast, match_type=match_type, matches=matches))

    hits.sort(key=lambda hit: latest_by_id.get(hit.broadcast.id) or hit.broadcast.created_at, reverse=True)
    return hits
