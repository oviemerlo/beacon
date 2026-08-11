import uuid
from datetime import datetime

from geoalchemy2 import Geography
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class Broadcast(Base):
    __tablename__ = "broadcasts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sender_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content: Mapped[str] = mapped_column(String(2000), nullable=False)

    # Origin point the radius is measured from. Defaults to the sender's
    # registered location but a business can choose an arbitrary point
    # (e.g. targeting a neighborhood they're opening a shop in).
    origin_point: Mapped[str] = mapped_column(Geography(geometry_type="POINT", srid=4326), nullable=False)
    is_global: Mapped[bool] = mapped_column(Boolean, default=False)
    radius_meters: Mapped[int | None] = mapped_column(Integer, nullable=True)

    tag_match_mode: Mapped[str] = mapped_column(String(10), default="any")  # 'any' | 'all'
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    tags: Mapped[list["BroadcastTag"]] = relationship(back_populates="broadcast", cascade="all, delete-orphan")
    sender: Mapped["User"] = relationship()


class BroadcastTag(Base):
    __tablename__ = "broadcast_tags"

    broadcast_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("broadcasts.id", ondelete="CASCADE"), primary_key=True)
    tag_id: Mapped[int] = mapped_column(ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True)

    broadcast: Mapped["Broadcast"] = relationship(back_populates="tags")
    tag: Mapped["Tag"] = relationship()


class BroadcastImpression(Base):
    """
    Records that a broadcast was actually served into a user's feed while
    they were within radius. This is the source of truth for DM eligibility
    (see services/matching.py) rather than re-checking live distance, so a
    user who moved — or a broadcast that expired — can't retroactively
    invalidate a conversation that was legitimately started.
    """

    __tablename__ = "broadcast_impressions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    broadcast_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("broadcasts.id", ondelete="CASCADE"), nullable=False)
    viewer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    shown_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
