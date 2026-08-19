import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tag_type: Mapped[str] = mapped_column(String(20), nullable=False)  # 'nationality' | 'continent' | 'hobby' | 'community'
    label: Mapped[str] = mapped_column(String(100), nullable=False)

    __table_args__ = (UniqueConstraint("tag_type", "label", name="uq_tag_type_label"),)


class UserTag(Base):
    """Tags on a user's own profile (used for feed ranking / boosting)."""

    __tablename__ = "user_tags"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    tag_id: Mapped[int] = mapped_column(ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True)

    user: Mapped["User"] = relationship(back_populates="user_tags")
    tag: Mapped["Tag"] = relationship()


class UserFollowedTag(Base):
    """Explicit opt-in follows — powers the 'Opt-in' feed tab and digest."""

    __tablename__ = "user_followed_tags"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    tag_id: Mapped[int] = mapped_column(ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True)
    notifications_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
