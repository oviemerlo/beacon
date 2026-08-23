import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class School(Base):
    __tablename__ = "schools"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    email_domains: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False)

    verifications: Mapped[list["SchoolVerification"]] = relationship(back_populates="school")

    __table_args__ = (UniqueConstraint("name", "country", name="uq_school_name_country"),)


class SchoolVerification(Base):
    __tablename__ = "school_verifications"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id"), nullable=False)
    school_email: Mapped[str] = mapped_column(String(255), nullable=False)
    otp_code_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    otp_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    otp_attempts: Mapped[int] = mapped_column(Integer, default=0)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    reverification_reminder_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship(back_populates="school_verification")
    school: Mapped["School"] = relationship(back_populates="verifications")


class UserCourseEnrollment(Base):
    __tablename__ = "user_course_enrollments"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id"), primary_key=True)
    course_code: Mapped[str] = mapped_column(String(30), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
