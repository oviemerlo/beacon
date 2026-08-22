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
from app.repositories import block_repository, broadcast_repository, conversation_repository, user_repository
from app.services.exceptions import ForbiddenError, NotFoundError


async def _assert_messaging_allowed(db: AsyncSession, user_a: uuid.UUID, user_b: uuid.UUID) -> None:
    if await block_repository.is_blocked_either_direction(db, user_a, user_b):
        raise ForbiddenError("Messaging is unavailable between these users")


async def _assert_can_initiate(db: AsyncSession, initiator_id: uuid.UUID, broadcast_id: uuid.UUID) -> Broadcast:
    broadcast = await broadcast_repository.get_by_id(db, broadcast_id)
    if broadcast is None or broadcast.deleted_at is not None:
        raise NotFoundError("Broadcast not found")
    if broadcast.sender_id == initiator_id:
        raise ForbiddenError("Cannot start a conversation with yourself")

    if not await broadcast_repository.has_impression(db, broadcast_id, initiator_id):
        raise ForbiddenError("This broadcast was never shown in your feed")

    await _assert_messaging_allowed(db, initiator_id, broadcast.sender_id)

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
    conversation = await _assert_participant(db, user_id, conversation_id)
    messages = await conversation_repository.list_messages(db, conversation_id)
    await conversation_repository.mark_read_for_user_in_conversation(db, user_id, conversation.id)
    await db.commit()
    return messages


async def send_message(db: AsyncSession, user_id: uuid.UUID, conversation_id: str, body: str) -> Message:
    conversation = await _assert_participant(db, user_id, conversation_id)
    other_user_id = conversation.recipient_id if conversation.initiator_id == user_id else conversation.initiator_id
    await _assert_messaging_allowed(db, user_id, other_user_id)
    message = await conversation_repository.add_message(db, conversation_id, user_id, body)
    await db.commit()
    await db.refresh(message)
    return message


async def list_conversations_for_user(db: AsyncSession, user_id: uuid.UUID) -> list[dict]:
    conversations = await conversation_repository.list_for_user(db, user_id)
    items: list[dict] = []
    for conversation in conversations:
        other_user_id = conversation.recipient_id if conversation.initiator_id == user_id else conversation.initiator_id
        other_user = await user_repository.get_by_id(db, other_user_id)
        latest = await conversation_repository.latest_message_for_conversation(db, conversation.id)
        origin_preview = (conversation.origin_broadcast.content if conversation.origin_broadcast is not None else "").strip()
        items.append(
            {
                "id": str(conversation.id),
                "origin_broadcast_id": str(conversation.origin_broadcast_id),
                "origin_broadcast_preview": origin_preview[:160] if origin_preview else "Original broadcast unavailable.",
                "origin_broadcast_sender_display_name": (
                    conversation.origin_broadcast.sender.display_name
                    if conversation.origin_broadcast is not None and conversation.origin_broadcast.sender is not None
                    else "Unknown"
                ),
                "is_reply_to_you": conversation.recipient_id == user_id,
                "other_participant": {
                    "id": str(other_user_id),
                    "display_name": other_user.display_name if other_user else "Unknown",
                },
                "last_message_sender_id": str(latest.sender_id) if latest else str(other_user_id),
                "last_message": latest.body if latest else "",
                "last_message_at": latest.sent_at if latest else conversation.created_at,
                "unread_count": await conversation_repository.count_unread_in_conversation(db, user_id, conversation.id),
            }
        )
    items.sort(key=lambda item: item["last_message_at"], reverse=True)
    return items


async def get_unread_count(db: AsyncSession, user_id: uuid.UUID) -> int:
    return await conversation_repository.count_unread_for_user(db, user_id)


async def mark_all_seen(db: AsyncSession, user_id: uuid.UUID) -> None:
    await conversation_repository.mark_all_read_for_user(db, user_id)
    await db.commit()


async def get_conversation_context(db: AsyncSession, user_id: uuid.UUID, conversation_id: str) -> dict:
    await _assert_participant(db, user_id, conversation_id)
    conversation = await conversation_repository.get_by_id_with_origin(db, conversation_id)
    if conversation is None:
        raise NotFoundError("Conversation not found")
    origin_preview = (conversation.origin_broadcast.content if conversation.origin_broadcast is not None else "").strip()
    origin_sender = conversation.origin_broadcast.sender if conversation.origin_broadcast is not None else None
    other_user_id = conversation.recipient_id if conversation.initiator_id == user_id else conversation.initiator_id
    other_user = await user_repository.get_by_id(db, other_user_id)
    return {
        "id": str(conversation.id),
        "origin_broadcast_id": str(conversation.origin_broadcast_id),
        "origin_broadcast_preview": origin_preview[:220] if origin_preview else "Original broadcast unavailable.",
        "origin_broadcast_sender_id": str(origin_sender.id) if origin_sender is not None else None,
        "origin_broadcast_sender_display_name": origin_sender.display_name if origin_sender is not None else "Unknown",
        "other_participant_id": str(other_user_id),
        "other_participant_display_name": other_user.display_name if other_user is not None else "Unknown",
    }
