"""
Messaging business rules — most importantly, the broadcast-initiated DM
rule: a conversation can only be started by someone who actually had a
given broadcast served into their feed, reaching out to that broadcast's
sender. See docs/PRODUCT_BRIEF.md '§Messaging' and '§Why DM eligibility
uses a stored impression, not live distance' for the reasoning; this is
the single place that rule is enforced, so every route that touches
messaging goes through here rather than re-implementing the check.
"""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.broadcast import Broadcast
from app.models.conversation import Conversation, Message
from app.repositories import block_repository, broadcast_repository, conversation_repository
from app.services.exceptions import ForbiddenError, NotFoundError


async def _assert_can_initiate(db: AsyncSession, initiator_id: uuid.UUID, broadcast_id: uuid.UUID) -> Broadcast:
    broadcast = await broadcast_repository.get_by_id(db, broadcast_id)
    if broadcast is None:
        raise NotFoundError("Broadcast not found")
    if broadcast.sender_id == initiator_id:
        raise ForbiddenError("Cannot start a conversation with yourself")

    if not await broadcast_repository.has_impression(db, broadcast_id, initiator_id):
        raise ForbiddenError("This broadcast was never shown in your feed")

    if await block_repository.is_blocked_either_direction(db, initiator_id, broadcast.sender_id):
        raise ForbiddenError("Messaging is unavailable between these users")

    return broadcast


async def start_conversation(db: AsyncSession, initiator_id: uuid.UUID, broadcast_id: uuid.UUID, first_message: str) -> Conversation:
    broadcast = await _assert_can_initiate(db, initiator_id, broadcast_id)

    conversation = await conversation_repository.find_existing(db, initiator_id, broadcast.sender_id, broadcast.id)
    if conversation is None:
        conversation = await conversation_repository.create(db, initiator_id, broadcast.sender_id, broadcast.id)

    await conversation_repository.add_message(db, conversation.id, initiator_id, first_message)
    await db.commit()
    await db.refresh(conversation)
    return conversation


async def _assert_participant(db: AsyncSession, user_id: uuid.UUID, conversation_id: str) -> Conversation:
    conversation = await conversation_repository.get_by_id(db, conversation_id)
    if conversation is None or user_id not in (conversation.initiator_id, conversation.recipient_id):
        raise NotFoundError("Conversation not found")
    return conversation


async def list_messages(db: AsyncSession, user_id: uuid.UUID, conversation_id: str) -> list[Message]:
    await _assert_participant(db, user_id, conversation_id)
    return await conversation_repository.list_messages(db, conversation_id)


async def send_message(db: AsyncSession, user_id: uuid.UUID, conversation_id: str, body: str) -> Message:
    await _assert_participant(db, user_id, conversation_id)
    message = await conversation_repository.add_message(db, conversation_id, user_id, body)
    await db.commit()
    await db.refresh(message)
    return message
