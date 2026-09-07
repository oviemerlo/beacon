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
from app.models.conversation import Conversation, ConversationInvite, Message
from app.repositories import (
    block_repository,
    broadcast_repository,
    conversation_repository,
    link_preview_repository,
    notification_repository,
    user_repository,
)
from app.services import mention_service
from app.services.broadcast_tags import _link_preview_payload
from app.services.exceptions import ForbiddenError, NotFoundError, ValidationError
from app.services.link_preview_service import schedule_previews


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

    root_echo_id = broadcast.parent_broadcast_id or broadcast.id
    mentioned_user_ids = await mention_service.validate_mentions_for_echo(db, first_message, root_echo_id, initiator_id)
    message = await conversation_repository.add_message(
        db, conversation.id, initiator_id, first_message, mentioned_user_ids
    )
    await _notify_mentions(db, message)
    await db.commit()
    await db.refresh(conversation)
    schedule_previews(first_message, message_id=message.id)
    return conversation


async def _assert_participant(db: AsyncSession, user_id: uuid.UUID, conversation_id: str) -> Conversation:
    conversation = await conversation_repository.get_by_id(db, conversation_id)
    if conversation is None or not await conversation_repository.is_participant(db, conversation.id, user_id):
        raise NotFoundError("Conversation not found")
    return conversation


async def _attach_message_link_previews(db: AsyncSession, messages: list[Message]) -> None:
    by_id = await link_preview_repository.list_ok_for_messages(db, [m.id for m in messages])
    for message in messages:
        message.link_previews = [_link_preview_payload(p) for p in by_id.get(message.id, [])]


async def list_messages(db: AsyncSession, user_id: uuid.UUID, conversation_id: str) -> list[Message]:
    conversation = await _assert_participant(db, user_id, conversation_id)
    messages = await conversation_repository.list_messages(db, conversation_id)
    await conversation_repository.mark_read_for_user_in_conversation(db, user_id, conversation.id)
    await notification_repository.mark_read_for_conversation(db, user_id, conversation.id)
    await db.commit()
    await _attach_message_link_previews(db, messages)
    return messages


async def send_message(db: AsyncSession, user_id: uuid.UUID, conversation_id: str, body: str) -> Message:
    conversation = await _assert_participant(db, user_id, conversation_id)
    mentioned_user_ids: list[uuid.UUID] = []
    if conversation.name is None:
        if conversation.initiator_id is None or conversation.recipient_id is None:
            raise NotFoundError("Conversation not found")
        other_user_id = conversation.recipient_id if conversation.initiator_id == user_id else conversation.initiator_id
        await _assert_messaging_allowed(db, user_id, other_user_id)
        if conversation.origin_broadcast_id is None:
            raise NotFoundError("Broadcast not found")
        root_echo_id = await conversation_repository.resolve_root_echo_id(db, conversation.origin_broadcast_id)
        if root_echo_id is None:
            raise NotFoundError("Broadcast not found")
        mentioned_user_ids = await mention_service.validate_mentions_for_echo(db, body, root_echo_id, user_id)
    message = await conversation_repository.add_message(db, conversation_id, user_id, body, mentioned_user_ids)
    await _notify_mentions(db, message)
    await db.commit()
    await db.refresh(message)
    schedule_previews(body, message_id=message.id)
    await _attach_message_link_previews(db, [message])
    return message


async def _notify_mentions(db: AsyncSession, message: Message) -> None:
    for user_id in message.mentioned_user_ids:
        await notification_repository.create_mentioned(
            db,
            user_id=user_id,
            message_id=message.id,
            conversation_id=message.conversation_id,
            actor_id=message.sender_id,
        )


async def list_mention_candidates(db: AsyncSession, user_id: uuid.UUID, conversation_id: str, query: str | None = None):
    conversation = await _assert_participant(db, user_id, conversation_id)
    other_user_id = None
    root_echo_id = None
    if conversation.name is None and conversation.initiator_id is not None and conversation.recipient_id is not None:
        other_user_id = conversation.recipient_id if conversation.initiator_id == user_id else conversation.initiator_id
        if conversation.origin_broadcast_id is not None:
            root_echo_id = await conversation_repository.resolve_root_echo_id(db, conversation.origin_broadcast_id)
        if root_echo_id is None:
            users = []
        else:
            users = await conversation_repository.list_mention_candidates(db, root_echo_id, user_id)
    else:
        participant_rows = await conversation_repository.get_participants(db, conversation.id)
        participant_ids = [row.user_id for row in participant_rows if row.user_id != user_id]
        users = []
        for participant_id in participant_ids:
            other = await user_repository.get_by_id(db, participant_id)
            if other is not None and not other.is_suspended:
                users.append(other)
    seen = {user.id for user in users}
    if other_user_id is not None and other_user_id != user_id and other_user_id not in seen:
        other = await user_repository.get_by_id(db, other_user_id)
        if other is not None and not other.is_suspended:
            users.append(other)
    prefix = (query or "").lstrip("@").strip().lower()
    if prefix:
        users = [user for user in users if user.username.lower().startswith(prefix) or user.display_name.lower().startswith(prefix)]
    return [
        {
            "id": str(user.id),
            "username": user.username,
            "display_name": user.display_name,
            "echo_id": str(root_echo_id) if root_echo_id is not None else None,
        }
        for user in users
    ]


async def list_unread_mentions(db: AsyncSession, user_id: uuid.UUID) -> list[dict]:
    rows = await notification_repository.list_unread_mentions(db, user_id)
    items: list[dict] = []
    for notification, message, conversation, actor in rows:
        origin_preview = (conversation.origin_broadcast.content if conversation.origin_broadcast is not None else "").strip()
        items.append(
            {
                "id": str(notification.id),
                "kind": notification.kind,
                "conversation_id": str(notification.conversation_id),
                "message_id": str(notification.message_id),
                "actor_id": str(actor.id),
                "actor_username": actor.username,
                "actor_display_name": actor.display_name,
                "body": message.body,
                "origin_broadcast_preview": origin_preview[:160] if origin_preview else "Original broadcast unavailable.",
                "created_at": notification.created_at,
                "is_own_conversation": await conversation_repository.is_participant(db, conversation.id, user_id),
            }
        )
    return items


async def mark_mention_read(db: AsyncSession, user_id: uuid.UUID, notification_id: str) -> None:
    notification = await notification_repository.mark_read(db, user_id, uuid.UUID(notification_id))
    if notification is None:
        raise NotFoundError("Notification not found")
    await db.commit()


async def hide_conversation(db: AsyncSession, user_id: uuid.UUID, conversation_id: str) -> None:
    conversation = await _assert_participant(db, user_id, conversation_id)
    await conversation_repository.hide_for_user(db, user_id, conversation.id)
    await db.commit()


async def list_conversations_for_user(db: AsyncSession, user_id: uuid.UUID) -> list[dict]:
    conversations = await conversation_repository.list_for_user(db, user_id)
    mention_conversation_ids = await notification_repository.unread_mention_conversation_ids(db, user_id)
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
                "has_mention": conversation.id in mention_conversation_ids,
            }
        )
    items.sort(key=lambda item: item["last_message_at"], reverse=True)
    return items


async def search_messages_for_user(db: AsyncSession, user_id: uuid.UUID, query: str) -> list[dict]:
    keyword = query.strip()
    if not keyword:
        raise ValidationError("A keyword is required")
    hits = await conversation_repository.search_messages_for_user(db, user_id, keyword)
    items: list[dict] = []
    for conversation, matches in hits:
        other_user_id = conversation.recipient_id if conversation.initiator_id == user_id else conversation.initiator_id
        other_user = await user_repository.get_by_id(db, other_user_id)
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
                "matches": [
                    {
                        "id": str(message.id),
                        "body": message.body,
                        "created_at": message.sent_at,
                    }
                    for message in matches
                ],
            }
        )
    return items


async def get_unread_count(db: AsyncSession, user_id: uuid.UUID) -> dict:
    return {
        "count": await conversation_repository.count_unread_for_user(db, user_id),
        "mention_count": await notification_repository.count_unread_mentions(db, user_id),
    }


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
    other_user_id = _other_participant_id(conversation, user_id)
    other_user = await user_repository.get_by_id(db, other_user_id) if other_user_id is not None else None
    participant_count = await conversation_repository.participant_count(db, conversation.id)
    participants: list[dict] = []
    if conversation.name is not None:
        participant_rows = await conversation_repository.get_participants(db, conversation.id)
        for row in participant_rows:
            member = await user_repository.get_by_id(db, row.user_id)
            participants.append(
                {
                    "user_id": str(row.user_id),
                    "display_name": member.display_name if member is not None else "Unknown",
                    "role": row.role,
                }
            )
    return {
        "id": str(conversation.id),
        "name": conversation.name,
        "max_participants": conversation.max_participants,
        "participant_count": participant_count,
        "participants": participants,
        "origin_broadcast_id": str(conversation.origin_broadcast_id) if conversation.origin_broadcast_id is not None else None,
        "origin_broadcast_preview": origin_preview[:220] if origin_preview else "Original broadcast unavailable.",
        "origin_broadcast_sender_id": str(origin_sender.id) if origin_sender is not None else None,
        "origin_broadcast_sender_display_name": origin_sender.display_name if origin_sender is not None else "Unknown",
        "other_participant_id": str(other_user_id) if other_user_id is not None else None,
        "other_participant_display_name": other_user.display_name if other_user is not None else (conversation.name or "Unknown"),
    }


def _other_participant_id(conversation: Conversation, user_id: uuid.UUID) -> uuid.UUID | None:
    if conversation.initiator_id is None or conversation.recipient_id is None:
        return None
    return conversation.recipient_id if conversation.initiator_id == user_id else conversation.initiator_id


async def create_group_conversation(
    db: AsyncSession, user_id: uuid.UUID, name: str, max_participants: int | None
) -> tuple[Conversation, ConversationInvite]:
    trimmed = name.strip()
    if not trimmed:
        raise ValidationError("Group name is required")
    conversation = await conversation_repository.create_group(db, trimmed, max_participants, user_id)
    invite = await conversation_repository.create_invite(db, conversation.id, user_id, description=None)
    await db.commit()
    return conversation, invite


async def get_invite_preview(db: AsyncSession, token: str) -> dict:
    invite = await conversation_repository.get_invite_by_token(db, token)
    if invite is None or invite.revoked_at is not None:
        raise NotFoundError("This invite is no longer active")
    conversation = await conversation_repository.get_by_id(db, invite.conversation_id)
    if conversation is None:
        raise NotFoundError("This invite is no longer active")
    count = await conversation_repository.participant_count(db, conversation.id)
    is_full = conversation.max_participants is not None and count >= conversation.max_participants
    return {
        "conversation_name": conversation.name or "",
        "description": invite.description,
        "participant_count": count,
        "max_participants": conversation.max_participants,
        "is_full": is_full,
    }


async def join_via_invite(db: AsyncSession, user_id: uuid.UUID, token: str) -> Conversation:
    invite = await conversation_repository.get_invite_by_token(db, token)
    if invite is None or invite.revoked_at is not None:
        raise NotFoundError("This invite is no longer active")
    conversation = await conversation_repository.get_by_id(db, invite.conversation_id)
    if conversation is None:
        raise NotFoundError("This invite is no longer active")
    if await conversation_repository.is_participant(db, conversation.id, user_id):
        return conversation
    # Capacity check + insert run under SELECT ... FOR UPDATE inside add_participant.
    await conversation_repository.add_participant(db, conversation.id, user_id)
    await db.commit()
    return conversation


async def list_groups_for_user(db: AsyncSession, user_id: uuid.UUID) -> list[dict]:
    conversations = await conversation_repository.list_groups_for_user(db, user_id)
    items: list[dict] = []
    for conversation in conversations:
        latest = await conversation_repository.latest_message_for_conversation(db, conversation.id)
        items.append(
            {
                "id": str(conversation.id),
                "name": conversation.name,
                "max_participants": conversation.max_participants,
                "participant_count": await conversation_repository.participant_count(db, conversation.id),
                "last_message": latest.body if latest else "",
                "last_message_at": latest.sent_at if latest else conversation.created_at,
                "unread_count": await conversation_repository.count_unread_in_conversation(db, user_id, conversation.id),
            }
        )
    return items


async def leave_group(db: AsyncSession, user_id: uuid.UUID, conversation_id: str) -> None:
    conversation = await _assert_participant(db, user_id, conversation_id)
    if conversation.name is None:
        raise ForbiddenError("Can't leave a direct conversation — delete it instead")
    await conversation_repository.remove_participant(db, conversation.id, user_id)
    await db.commit()


async def promote_to_admin(
    db: AsyncSession, acting_user_id: uuid.UUID, conversation_id: str, target_user_id: uuid.UUID
) -> None:
    conversation = await _assert_participant(db, acting_user_id, conversation_id)
    if conversation.name is None:
        raise ForbiddenError("Can't promote members in a direct conversation")
    if not await conversation_repository.is_admin(db, conversation.id, acting_user_id):
        raise ForbiddenError("Only admins can promote other members")
    if not await conversation_repository.is_participant(db, conversation.id, target_user_id):
        raise NotFoundError("That user isn't in this group")
    await conversation_repository.promote_many(db, conversation.id, [target_user_id])
    await db.commit()
