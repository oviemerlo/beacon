"""Data access for Conversation and Message."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

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
    """Used by the digest — how many messages are waiting that this user didn't send."""
    result = await db.execute(
        select(Message)
        .join(Conversation, Conversation.id == Message.conversation_id)
        .where(
            (Conversation.initiator_id == user_id) | (Conversation.recipient_id == user_id),
            Message.sender_id != user_id,
            Message.read_at.is_(None),
        )
    )
    return len(result.scalars().all())


async def list_for_user(db: AsyncSession, user_id: uuid.UUID) -> list[Conversation]:
    result = await db.execute(
        select(Conversation)
        .where((Conversation.initiator_id == user_id) | (Conversation.recipient_id == user_id))
        .options(selectinload(Conversation.origin_broadcast))
        .order_by(Conversation.created_at.desc())
    )
    return list(result.scalars().all())


async def latest_message_for_conversation(db: AsyncSession, conversation_id: uuid.UUID) -> Message | None:
    result = await db.execute(
        select(Message).where(Message.conversation_id == conversation_id).order_by(Message.sent_at.desc()).limit(1)
    )
    return result.scalar_one_or_none()
