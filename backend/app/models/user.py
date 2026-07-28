import uuid
from datetime import datetime

from geoalchemy2 import Geography
from geoalchemy2.shape import to_shape
from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.ext.associationproxy import association_proxy

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    account_type: Mapped[str] = mapped_column(String(20), default="individual")  # individual | business
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)

    # Registered location. Stored precisely; every read path that can reach
    # an API response must round/jitter it — see services/matching.py.
    location: Mapped[str] = mapped_column(Geography(geometry_type="POINT", srid=4326), nullable=False)
    location_label: Mapped[str | None] = mapped_column(String(200), nullable=True)

    feed_radius_meters: Mapped[int] = mapped_column(default=8000)
    discoverable_in_broadcasts: Mapped[bool] = mapped_column(Boolean, default=True)  # opt-out toggle

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_digest_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    oauth_accounts: Mapped[list["OAuthAccount"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    user_tags: Mapped[list["UserTag"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    # `tags` resolves through user_tags -> Tag, so `user.tags` gives you
    # Tag objects (id, tag_type, label) directly — matching what TagOut
    # expects. Must be eager-loaded via user_repository.get_by_id_with_tags.
    tags = association_proxy("user_tags", "tag")

    @property
    def latitude(self) -> float | None:
        """Self-view convenience field derived from the stored point geometry."""
        if self.location is None:
            return None
        try:
            return float(to_shape(self.location).y)
        except Exception:
            return None

    @property
    def longitude(self) -> float | None:
        """Self-view convenience field derived from the stored point geometry."""
        if self.location is None:
            return None
        try:
            return float(to_shape(self.location).x)
        except Exception:
            return None


class OAuthAccount(Base):
    """Links a user to an external identity provider (Google, Apple, etc.)."""

    __tablename__ = "oauth_accounts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    provider: Mapped[str] = mapped_column(String(20), nullable=False)  # 'google' | 'apple'
    provider_user_id: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="oauth_accounts")

    __table_args__ = (UniqueConstraint("provider", "provider_user_id", name="uq_provider_identity"),)
