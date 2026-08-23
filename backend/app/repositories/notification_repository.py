import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.broadcast import Broadcast
from app.models.conversation import Conversation, Message
from app.models.notification import Notification
from app.models.user import User


async def create_mentioned(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    message_id: uuid.UUID,
    conversation_id: uuid.UUID,
    actor_id: uuid.UUID,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        kind="mentioned",
        message_id=message_id,
        conversation_id=conversation_id,
        actor_id=actor_id,
    )
    db.add(notification)
    await db.flush()
    return notification


async def count_unread_mentions(db: AsyncSession, user_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == user_id,
            Notification.kind == "mentioned",
            Notification.read_at.is_(None),
        )
    )
    return int(result.scalar_one() or 0)


async def unread_mention_conversation_ids(db: AsyncSession, user_id: uuid.UUID) -> set[uuid.UUID]:
    result = await db.execute(
        select(Notification.conversation_id).where(
            Notification.user_id == user_id,
            Notification.kind == "mentioned",
            Notification.read_at.is_(None),
        )
    )
    return {row[0] for row in result.all()}


async def list_unread_mentions(db: AsyncSession, user_id: uuid.UUID, limit: int = 30):
    result = await db.execute(
        select(Notification, Message, Conversation, User)
        .join(Message, Message.id == Notification.message_id)
        .join(Conversation, Conversation.id == Notification.conversation_id)
        .join(User, User.id == Notification.actor_id)
        .options(selectinload(Conversation.origin_broadcast).selectinload(Broadcast.sender))
        .where(Notification.user_id == user_id, Notification.kind == "mentioned", Notification.read_at.is_(None))
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    return result.all()


async def mark_read_for_conversation(db: AsyncSession, user_id: uuid.UUID, conversation_id: uuid.UUID) -> None:
    await db.execute(
        update(Notification)
        .where(
            Notification.user_id == user_id,
            Notification.conversation_id == conversation_id,
            Notification.read_at.is_(None),
        )
        .values(read_at=datetime.now(timezone.utc))
    )
    await db.flush()


async def mark_read(db: AsyncSession, user_id: uuid.UUID, notification_id: uuid.UUID) -> Notification | None:
    notification = await db.get(Notification, notification_id)
    if notification is None or notification.user_id != user_id:
        return None
    if notification.read_at is None:
        notification.read_at = datetime.now(timezone.utc)
        await db.flush()
    return notification
