"""School verification business logic."""

import hashlib
import math
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.config import settings
from app.utils.email import EmailDeliveryError, send_otp_email, send_reverification_reminder_email
from app.models.school import School
from app.models.tag import Tag
from app.repositories import school_repository, tag_repository, user_repository
from app.utils.course_tags import COURSE_TAG_MAX_LEN, canonical_course_tag, compact_course_key
from app.services.exceptions import ForbiddenError, NotFoundError, ValidationError

OTP_TTL = timedelta(minutes=10)
OTP_RESEND_COOLDOWN = timedelta(seconds=60)


def school_tag_label(school: School) -> str:
    if school.country:
        return f"{school.name} ({school.country})"
    return school.name


def school_tag_matches(tag: Tag, school: School) -> bool:
    return tag.tag_type == "school" and tag.label in {school.name, school_tag_label(school)}


def prepare_course_tag(course_code: str) -> str:
    compact = compact_course_key(course_code)
    if not compact:
        raise ValidationError("course_code is required")
    if len(compact) > COURSE_TAG_MAX_LEN:
        raise ValidationError(f"course_code must be at most {COURSE_TAG_MAX_LEN} letters and digits")
    return canonical_course_tag(course_code)


def _hash_otp(code: str) -> str:
    return hashlib.sha256(f"{settings.JWT_SECRET}:{code}".encode("utf-8")).hexdigest()


def _normalize_email_domain(value: str) -> str:
    domain = value.lower().strip().rstrip(".")
    if domain.startswith("www."):
        domain = domain[4:]
    return domain


def _email_domain_matches_school(email_domain: str, allowed_domains: list[str]) -> bool:
    """Match an email host against a school's listed domains.

    The Hipo university-domains dataset stores the university domain
    (usc.edu, yorku.ca), while student mail often uses a host prefix
    (cs.usc.edu, my.yorku.ca). Exact match or a subdomain of a listed
    domain is accepted.
    """
    domain = _normalize_email_domain(email_domain)
    if not domain or "@" in domain or "/" in domain or " " in domain:
        return False
    allowed = {_normalize_email_domain(item) for item in allowed_domains if item}
    if domain in allowed:
        return True
    return any(domain.endswith(f".{item}") for item in allowed if item)


async def search_schools(db: AsyncSession, query: str) -> list[School]:
    if len(query.strip()) < 2:
        raise ValidationError("Query must be at least 2 characters")
    return await school_repository.search_by_name(db, query.strip())


async def start_verification(db: AsyncSession, user_id: uuid.UUID, school_id: int, school_email: str) -> None:
    school = await school_repository.get_by_id(db, school_id)
    if school is None:
        raise NotFoundError("School not found")

    if "@" not in school_email:
        raise ValidationError("Email domain does not match this school")
    domain = school_email.rsplit("@", 1)[1]
    if not _email_domain_matches_school(domain, school.email_domains):
        raise ValidationError("Email domain does not match this school")

    existing = await school_repository.get_verification(db, user_id)
    if existing is not None:
        expires_at = existing.otp_expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        issued_at = expires_at - OTP_TTL
        remaining = (issued_at + OTP_RESEND_COOLDOWN - datetime.now(timezone.utc)).total_seconds()
        if remaining > 0:
            seconds = max(1, math.ceil(remaining))
            raise ValidationError(f"Wait {seconds} seconds before requesting another code.")

    otp_code = f"{secrets.randbelow(1_000_000):06d}"
    otp_code_hash = _hash_otp(otp_code)
    otp_expires_at = datetime.now(timezone.utc) + OTP_TTL

    await school_repository.create_or_update_verification(
        db,
        user_id=user_id,
        school_id=school_id,
        school_email=school_email,
        otp_code_hash=otp_code_hash,
        otp_expires_at=otp_expires_at,
    )
    try:
        send_otp_email(to_email=school_email, code=otp_code)
    except EmailDeliveryError:
        raise ValidationError("Couldn't send the verification email. Try again.")
    await db.commit()


async def confirm_verification(db: AsyncSession, user_id: uuid.UUID, code: str) -> None:
    verification = await school_repository.get_verification(db, user_id)
    if verification is None:
        raise NotFoundError("No pending school verification")

    now = datetime.now(timezone.utc)
    if verification.otp_expires_at < now:
        raise ValidationError("Verification code has expired")
    if verification.otp_attempts >= 5:
        raise ValidationError("Too many incorrect attempts")

    provided_hash = _hash_otp(code)
    if not secrets.compare_digest(provided_hash, verification.otp_code_hash):
        await school_repository.increment_otp_attempts(db, user_id)
        await db.commit()
        raise ValidationError("Incorrect code")

    school = await school_repository.get_by_id(db, verification.school_id)
    if school is None:
        raise NotFoundError("School not found")

    await school_repository.mark_verified(db, user_id)
    user = await user_repository.get_by_id(db, user_id)
    if user is not None:
        await user_repository.update_fields(db, user, is_verified=True)

    label = school_tag_label(school)
    school_tag = await tag_repository.get_by_type_and_label(db, "school", label)
    if school_tag is None:
        school_tag = await tag_repository.create(db, tag_type="school", label=label)
    await user_repository.replace_school_tag(db, user_id, school_tag.id)

    await db.commit()


def is_currently_verified(verification) -> bool:
    if verification.verified_at is None:
        return False
    if verification.expires_at is None:
        return True
    return verification.expires_at > datetime.now(timezone.utc)


async def get_verification_status(db: AsyncSession, user_id: uuid.UUID) -> tuple[int | None, str | None, bool]:
    verification = await school_repository.get_verification(db, user_id)
    if verification is None:
        return None, None, False

    verified = is_currently_verified(verification)
    school = await school_repository.get_by_id(db, verification.school_id)
    if school is None:
        return verification.school_id, None, verified
    return school.id, school_tag_label(school), verified


async def send_reverification_reminders(db: AsyncSession) -> int:
    verifications = await school_repository.list_verifications_needing_reminder(db, timedelta(days=7))
    sent = 0
    for verification in verifications:
        school_name = verification.school.name if verification.school is not None else "your school"
        try:
            send_reverification_reminder_email(
                to_email=verification.school_email,
                school_name=school_name,
                expires_at=verification.expires_at,
            )
        except EmailDeliveryError:
            continue
        await school_repository.mark_reminder_sent(db, verification.user_id)
        sent += 1
    await db.commit()
    return sent


async def expire_lapsed_verifications(db: AsyncSession) -> int:
    verifications = await school_repository.list_verifications_expired(db)
    for verification in verifications:
        await user_repository.update_fields(db, verification.user, is_verified=False)
    await db.commit()
    return len(verifications)


async def _require_verified_school(db: AsyncSession, user_id: uuid.UUID):
    verification = await school_repository.get_verification(db, user_id)
    if verification is None or not is_currently_verified(verification):
        raise ForbiddenError("Verify your school before adding a course")
    return verification


async def enroll_in_course(db: AsyncSession, user_id: uuid.UUID, course_code: str) -> None:
    verification = await _require_verified_school(db, user_id)
    canonical = prepare_course_tag(course_code)
    enrollments = await school_repository.list_enrollments(db, user_id, verification.school_id)
    for item in enrollments:
        if item.course_code != canonical and canonical_course_tag(item.course_code) == canonical:
            await school_repository.remove_enrollment(db, user_id, verification.school_id, item.course_code)
    await school_repository.add_enrollment(db, user_id, verification.school_id, canonical)
    await db.commit()


async def unenroll_from_course(db: AsyncSession, user_id: uuid.UUID, course_code: str) -> None:
    verification = await _require_verified_school(db, user_id)
    await school_repository.remove_enrollment(db, user_id, verification.school_id, prepare_course_tag(course_code))
    await db.commit()


async def get_my_courses(db: AsyncSession, user_id: uuid.UUID) -> list[str]:
    verification = await school_repository.get_verification(db, user_id)
    if verification is None or not is_currently_verified(verification):
        return []
    enrollments = await school_repository.list_enrollments(db, user_id, verification.school_id)
    return [item.course_code for item in enrollments]
