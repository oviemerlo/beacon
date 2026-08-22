"""Data access for Conversation and Message."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select, update
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


async def add_message(db: AsyncSession, conversation_id: uuid.UUID, sender_id: uuid.UUID, body: str) -> Message:
    message = Message(conversation_id=conversation_id, sender_id=sender_id, body=body)
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
