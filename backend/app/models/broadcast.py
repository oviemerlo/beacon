import uuid
from datetime import datetime

from geoalchemy2 import Geography
from sqlalchemy import Boolean, Computed, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import TSVECTOR, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.school import School
    from app.models.user import User


class Broadcast(Base):
    __tablename__ = "broadcasts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sender_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    parent_broadcast_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("broadcasts.id", ondelete="CASCADE"),
        nullable=True,
    )
    content: Mapped[str] = mapped_column(String(2000), nullable=False)

    # Origin point the radius is measured from. Defaults to the sender's
    # registered location but a business can choose an arbitrary point
    # (e.g. targeting a neighborhood they're opening a shop in).
    origin_point: Mapped[str] = mapped_column(Geography(geometry_type="POINT", srid=4326), nullable=False)
    is_global: Mapped[bool] = mapped_column(Boolean, default=False)
    radius_meters: Mapped[int | None] = mapped_column(Integer, nullable=True)
    school_id: Mapped[int | None] = mapped_column(ForeignKey("schools.id"), nullable=True)
    course_code: Mapped[str | None] = mapped_column(String(30), nullable=True)

    include_sender_avatar: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    tag_match_mode: Mapped[str] = mapped_column(String(10), default="any")  # 'any' | 'all'
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    search_vector: Mapped[str] = mapped_column(
        TSVECTOR,
        Computed("to_tsvector('english', coalesce(content, ''))", persisted=True),
    )

    tags: Mapped[list["BroadcastTag"]] = relationship(back_populates="broadcast", cascade="all, delete-orphan")
    sender: Mapped["User"] = relationship()
    school: Mapped["School | None"] = relationship()
    parent_broadcast: Mapped["Broadcast | None"] = relationship(
        "Broadcast",
        remote_side="Broadcast.id",
        back_populates="replies",
    )
    replies: Mapped[list["Broadcast"]] = relationship("Broadcast", back_populates="parent_broadcast")


class BroadcastCourse(Base):
    """Course codes this Echo is AND-gated on — classmates must be enrolled in every selected course."""

    __tablename__ = "broadcast_courses"

    broadcast_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("broadcasts.id", ondelete="CASCADE"), primary_key=True)
    course_code: Mapped[str] = mapped_column(String(30), primary_key=True)


class HiddenBroadcast(Base):
    """Per-viewer hide — the post stays visible to everyone else."""

    __tablename__ = "hidden_broadcasts"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    broadcast_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("broadcasts.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


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

    __table_args__ = (UniqueConstraint("broadcast_id", "viewer_id", name="uq_broadcast_impressions_broadcast_viewer"),)
