import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.broadcast import Broadcast
    from app.models.user import User


class UploadedFile(Base):
    __tablename__ = "uploaded_files"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    uploader_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    context: Mapped[str] = mapped_column(String(40), nullable=False)  # avatar | broadcast_attachment
    broadcast_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("broadcasts.id", ondelete="CASCADE"), nullable=True
    )
    s3_key: Mapped[str] = mapped_column(String(500), nullable=False, unique=True)
    thumbnail_s3_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    scan_status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    moderation_status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    moderation_labels: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    uploader: Mapped["User"] = relationship()
    broadcast: Mapped["Broadcast | None"] = relationship()

    __table_args__ = (
        UniqueConstraint("s3_key", name="uq_uploaded_files_s3_key"),
        CheckConstraint("context IN ('avatar', 'broadcast_attachment')", name="ck_uploaded_files_context"),
        CheckConstraint(
            "scan_status IN ('pending', 'clean', 'infected', 'scan_failed')",
            name="ck_uploaded_files_scan_status",
        ),
        CheckConstraint(
            "moderation_status IN ('pending', 'clean', 'flagged', 'rejected')",
            name="ck_uploaded_files_moderation_status",
        ),
        CheckConstraint(
            "(context = 'avatar' AND broadcast_id IS NULL) OR "
            "(context = 'broadcast_attachment' AND broadcast_id IS NOT NULL)",
            name="ck_uploaded_files_broadcast_id",
        ),
    )
