"""Data access for Conversation and Message."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, or_, select, union, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.broadcast import Broadcast
from app.models.conversation import Conversation, Message


async def find_existing(db: AsyncSession, initiator_id: uuid.UUID, recipient_id: uuid.UUID, broadcast_id: uuid.UUID) -> Conversation | None:
    result = await db.execute(
        select(Conversation).where(
            Conversation.initiator_id == initiator_id,
            Conversation.recipient_id == recipient_id,
            Conversation.origin_broadcast_id == broadcast_id,
        )
    )
    return result.scalar_one_or_none()


async def create(db: AsyncSession, initiator_id: uuid.UUID, recipient_id: uuid.UUID, broadcast_id: uuid.UUID) -> Conversation:
    conversation = Conversation(initiator_id=initiator_id, recipient_id=recipient_id, origin_broadcast_id=broadcast_id)
    db.add(conversation)
    await db.flush()
    return conversation


async def get_by_id(db: AsyncSession, conversation_id: uuid.UUID | str) -> Conversation | None:
    return await db.get(Conversation, conversation_id)


async def get_by_id_with_origin(db: AsyncSession, conversation_id: uuid.UUID | str) -> Conversation | None:
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .options(selectinload(Conversation.origin_broadcast).selectinload(Broadcast.sender))
    )
    return result.scalar_one_or_none()


async def get_message_by_id(db: AsyncSession, message_id: uuid.UUID | str) -> Message | None:
    return await db.get(Message, message_id)


async def add_message(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    sender_id: uuid.UUID,
    body: str,
    mentioned_user_ids: list[uuid.UUID] | None = None,
) -> Message:
    message = Message(
        conversation_id=conversation_id,
        sender_id=sender_id,
        body=body,
        mentioned_user_ids=mentioned_user_ids or [],
    )
    db.add(message)
    await db.flush()
    return message


async def list_messages(db: AsyncSession, conversation_id: uuid.UUID | str) -> list[Message]:
    result = await db.execute(select(Message).where(Message.conversation_id == conversation_id).order_by(Message.sent_at.asc()))
    return list(result.scalars().all())


async def count_unread_for_user(db: AsyncSession, user_id: uuid.UUID) -> int:
    """How many incoming messages this user has not read."""
    result = await db.execute(
        select(func.count(Message.id))
        .join(Conversation, Conversation.id == Message.conversation_id)
        .where(
            (Conversation.initiator_id == user_id) | (Conversation.recipient_id == user_id),
            Message.sender_id != user_id,
            Message.read_at.is_(None),
        )
    )
    return int(result.scalar_one() or 0)


async def mark_read_for_user_in_conversation(db: AsyncSession, user_id: uuid.UUID, conversation_id: uuid.UUID) -> None:
    await db.execute(
        update(Message)
        .where(
            Message.conversation_id == conversation_id,
            Message.sender_id != user_id,
            Message.read_at.is_(None),
        )
        .values(read_at=datetime.now(timezone.utc))
    )
    await db.flush()


async def mark_all_read_for_user(db: AsyncSession, user_id: uuid.UUID) -> None:
    participant_conversation_ids = select(Conversation.id).where(
        (Conversation.initiator_id == user_id) | (Conversation.recipient_id == user_id)
    )
    await db.execute(
        update(Message)
        .where(
            Message.conversation_id.in_(participant_conversation_ids),
            Message.sender_id != user_id,
            Message.read_at.is_(None),
        )
        .values(read_at=datetime.now(timezone.utc))
    )
    await db.flush()


async def count_unread_in_conversation(db: AsyncSession, user_id: uuid.UUID, conversation_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.count(Message.id)).where(
            Message.conversation_id == conversation_id,
            Message.sender_id != user_id,
            Message.read_at.is_(None),
        )
    )
    return int(result.scalar_one() or 0)


async def list_for_user(db: AsyncSession, user_id: uuid.UUID) -> list[Conversation]:
    latest_sent_at = (
        select(func.max(Message.sent_at))
        .where(Message.conversation_id == Conversation.id)
        .correlate(Conversation)
        .scalar_subquery()
    )
    result = await db.execute(
        select(Conversation)
        .where((Conversation.initiator_id == user_id) | (Conversation.recipient_id == user_id))
        .options(selectinload(Conversation.origin_broadcast).selectinload(Broadcast.sender))
        .order_by(func.coalesce(latest_sent_at, Conversation.created_at).desc())
    )
    return list(result.scalars().all())


async def latest_message_for_conversation(db: AsyncSession, conversation_id: uuid.UUID) -> Message | None:
    result = await db.execute(
        select(Message).where(Message.conversation_id == conversation_id).order_by(Message.sent_at.desc()).limit(1)
    )
    return result.scalar_one_or_none()


async def search_messages_for_user(
    db: AsyncSession,
    user_id: uuid.UUID,
    query: str,
    limit: int = 50,
) -> list[tuple[Conversation, list[Message]]]:
    tsquery = func.plainto_tsquery("english", query)
    ranked_stmt = (
        select(
            Message.conversation_id,
            func.max(Message.sent_at).label("latest_match_at"),
        )
        .join(Conversation, Conversation.id == Message.conversation_id)
        .where(or_(Conversation.initiator_id == user_id, Conversation.recipient_id == user_id))
        .where(Message.search_vector.op("@@")(tsquery))
        .group_by(Message.conversation_id)
        .order_by(func.max(Message.sent_at).desc())
        .limit(limit)
    )
    ranked_rows = (await db.execute(ranked_stmt)).all()
    if not ranked_rows:
        return []

    conversation_ids = [row.conversation_id for row in ranked_rows]
    conversations_stmt = (
        select(Conversation)
        .where(Conversation.id.in_(conversation_ids))
        .options(selectinload(Conversation.origin_broadcast).selectinload(Broadcast.sender))
    )
    conversations = {c.id: c for c in (await db.execute(conversations_stmt)).scalars().all()}

    messages_stmt = (
        select(Message)
        .where(Message.conversation_id.in_(conversation_ids))
        .where(Message.search_vector.op("@@")(tsquery))
        .order_by(Message.sent_at.desc())
    )
    nested: dict[uuid.UUID, list[Message]] = {cid: [] for cid in conversation_ids}
    for message in (await db.execute(messages_stmt)).scalars().all():
        nested[message.conversation_id].append(message)

    hits: list[tuple[Conversation, list[Message]]] = []
    for conversation_id in conversation_ids:
        conversation = conversations.get(conversation_id)
        if conversation is None:
            continue
        hits.append((conversation, nested.get(conversation_id, [])))
    return hits


async def resolve_root_echo_id(db: AsyncSession, broadcast_id: uuid.UUID) -> uuid.UUID | None:
    broadcast = await db.get(Broadcast, broadcast_id)
    if broadcast is None:
        return None
    return broadcast.parent_broadcast_id or broadcast.id


async def list_echo_thread_ids(db: AsyncSession, root_echo_id: uuid.UUID) -> list[uuid.UUID]:
    reply_ids = (
        await db.execute(select(Broadcast.id).where(Broadcast.parent_broadcast_id == root_echo_id))
    ).scalars().all()
    return [root_echo_id, *reply_ids]


async def list_echo_participant_ids(db: AsyncSession, root_echo_id: uuid.UUID) -> list[uuid.UUID]:
    thread_ids = await list_echo_thread_ids(db, root_echo_id)
    echo_senders = select(Broadcast.sender_id).where(Broadcast.id.in_(thread_ids))
    dm_initiators = select(Conversation.initiator_id).where(Conversation.origin_broadcast_id.in_(thread_ids))
    dm_recipients = select(Conversation.recipient_id).where(Conversation.origin_broadcast_id.in_(thread_ids))
    result = await db.execute(union(echo_senders, dm_initiators, dm_recipients))
    return [row[0] for row in result.all()]


async def list_mention_candidates(db: AsyncSession, root_echo_id: uuid.UUID, exclude_user_id: uuid.UUID):
    from app.models.user import User

    participant_ids = await list_echo_participant_ids(db, root_echo_id)
    if not participant_ids:
        return []
    result = await db.execute(
        select(User)
        .where(User.id.in_(participant_ids))
        .where(User.id != exclude_user_id)
        .where(User.is_suspended.is_(False))
        .order_by(User.username)
    )
    return list(result.scalars().all())
