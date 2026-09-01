import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class LinkPreview(Base):
    __tablename__ = "link_previews"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    normalized_url: Mapped[str] = mapped_column(String(2048), unique=True, index=True, nullable=False)
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    site_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    favicon_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint(
            "status IN ('ok', 'failed')",
            name="ck_link_previews_status",
        ),
    )


class BroadcastLinkPreview(Base):
    __tablename__ = "broadcast_link_previews"

    broadcast_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("broadcasts.id", ondelete="CASCADE"), primary_key=True
    )
    link_preview_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("link_previews.id", ondelete="CASCADE"), primary_key=True
    )
    sort_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    preview: Mapped["LinkPreview"] = relationship()
    broadcast: Mapped["Broadcast"] = relationship()


class MessageLinkPreview(Base):
    __tablename__ = "message_link_previews"

    message_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("messages.id", ondelete="CASCADE"), primary_key=True
    )
    link_preview_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("link_previews.id", ondelete="CASCADE"), primary_key=True
    )
    sort_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    preview: Mapped["LinkPreview"] = relationship()
    message: Mapped["Message"] = relationship()
