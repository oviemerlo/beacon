"""Data access for School and SchoolVerification."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.school import School, SchoolVerification, UserCourseEnrollment


async def search_by_name(db: AsyncSession, query: str, limit: int = 10) -> list[School]:
    result = await db.execute(select(School).where(School.name.ilike(f"%{query}%")).order_by(School.name).limit(limit))
    return list(result.scalars().all())


async def get_by_id(db: AsyncSession, school_id: int) -> School | None:
    return await db.get(School, school_id)


async def get_verification(db: AsyncSession, user_id: uuid.UUID) -> SchoolVerification | None:
    return await db.get(SchoolVerification, user_id)


async def create_or_update_verification(
    db: AsyncSession,
    user_id: uuid.UUID,
    school_id: int,
    school_email: str,
    otp_code_hash: str,
    otp_expires_at: datetime,
) -> SchoolVerification:
    verification = await db.get(SchoolVerification, user_id)
    if verification is None:
        verification = SchoolVerification(
            user_id=user_id,
            school_id=school_id,
            school_email=school_email,
            otp_code_hash=otp_code_hash,
            otp_expires_at=otp_expires_at,
            otp_attempts=0,
            verified_at=None,
        )
        db.add(verification)
    else:
        verification.school_id = school_id
        verification.school_email = school_email
        verification.otp_code_hash = otp_code_hash
        verification.otp_expires_at = otp_expires_at
        verification.otp_attempts = 0
        verification.verified_at = None
    await db.flush()
    return verification


async def mark_verified(db: AsyncSession, user_id: uuid.UUID) -> SchoolVerification | None:
    verification = await db.get(SchoolVerification, user_id)
    if verification is None:
        return None
    verification.verified_at = datetime.now(timezone.utc)
    await db.flush()
    return verification


async def increment_otp_attempts(db: AsyncSession, user_id: uuid.UUID) -> int:
    verification = await db.get(SchoolVerification, user_id)
    if verification is None:
        return 0
    verification.otp_attempts += 1
    await db.flush()
    return verification.otp_attempts


async def add_enrollment(db: AsyncSession, user_id: uuid.UUID, school_id: int, course_code: str) -> None:
    existing = await db.get(UserCourseEnrollment, (user_id, school_id, course_code))
    if existing is None:
        db.add(UserCourseEnrollment(user_id=user_id, school_id=school_id, course_code=course_code))
        await db.flush()


async def remove_enrollment(db: AsyncSession, user_id: uuid.UUID, school_id: int, course_code: str) -> None:
    existing = await db.get(UserCourseEnrollment, (user_id, school_id, course_code))
    if existing is not None:
        await db.delete(existing)
        await db.flush()


async def list_enrollments(db: AsyncSession, user_id: uuid.UUID) -> list[UserCourseEnrollment]:
    result = await db.execute(
        select(UserCourseEnrollment)
        .where(UserCourseEnrollment.user_id == user_id)
        .order_by(UserCourseEnrollment.course_code.asc())
    )
    return list(result.scalars().all())


async def has_enrollment(db: AsyncSession, user_id: uuid.UUID, school_id: int, course_code: str) -> bool:
    result = await db.execute(
        select(UserCourseEnrollment.user_id).where(
            UserCourseEnrollment.user_id == user_id,
            UserCourseEnrollment.school_id == school_id,
            UserCourseEnrollment.course_code == course_code,
        )
    )
    return result.scalar_one_or_none() is not None
