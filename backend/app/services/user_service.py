"""Profile read/update and tag-follow business logic."""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.age import validate_date_of_birth
from app.utils.config import settings
from app.models.tag import Tag
from app.models.user import User
from app.repositories import tag_repository, upload_repository, user_repository
from app.schemas.schemas import FollowedTagsReplaceIn, ProfileUpdateIn, TagOut, UserProfileOut
from app.services import school_service
from app.services.exceptions import ForbiddenError, NotFoundError, ValidationError

FOLLOWABLE_TYPES = ("nationality", "region", "hobby")

REGION_TAGS_LOCKED_MESSAGE = (
    "Region tags are available to premium subscribers. "
    "Free accounts can follow country, hobby, school, and course tags."
)


def can_follow_region_tags(user: User) -> bool:
    return user.is_admin or user.is_verified


def can_use_regional_reach(user: User) -> bool:
    return user.is_admin or user.is_verified


def can_attach_files(user: User) -> bool:
    return user.is_admin or user.is_verified


def followed_tag_limit(account_type: str, is_admin: bool = False) -> int:
    if is_admin:
        return settings.FOLLOWED_TAG_LIMIT_ADMIN
    if account_type == "business":
        return settings.FOLLOWED_TAG_LIMIT_BUSINESS
    return settings.FOLLOWED_TAG_LIMIT_DEFAULT


def _identity_tags(user: User) -> list[Tag]:
    by_id: dict[int, Tag] = {}
    for tag in list(user.tags or []):
        if tag is not None:
            by_id[tag.id] = tag
    for row in user.followed_tag_rows:
        if row.tag is not None:
            by_id[row.tag.id] = row.tag
    tags = list(by_id.values())
    tags = [tag for tag in tags if tag.tag_type != "community"]
    if not can_follow_region_tags(user):
        tags = [tag for tag in tags if tag.tag_type != "region"]
    return tags


def _profile_out(user: User) -> UserProfileOut:
    profile = UserProfileOut.model_validate(user)
    return profile.model_copy(
        update={
            "tags": [TagOut.model_validate(tag) for tag in _identity_tags(user)],
            "followed_tag_limit": followed_tag_limit(user.account_type, user.is_admin),
        }
    )


async def _drop_community_tags(db: AsyncSession, user_id: uuid.UUID) -> bool:
    community_ids = await user_repository.list_identity_tag_ids_of_types(db, user_id, ("community",))
    if not community_ids:
        return False
    for tag_id in community_ids:
        await user_repository.unfollow_and_disown(db, user_id, tag_id)
    return True


async def _load_profile(db: AsyncSession, user_id: uuid.UUID) -> UserProfileOut:
    user = await user_repository.get_by_id_with_tags(db, user_id)
    if user is None:
        raise NotFoundError("User not found")
    dropped = await _drop_community_tags(db, user.id)
    dropped = await _drop_locked_region_tags(db, user) or dropped
    if dropped:
        await db.commit()
        user = await user_repository.get_by_id_with_tags(db, user_id)
        if user is None:
            raise NotFoundError("User not found")
    profile = _profile_out(user)
    course_codes = await school_service.get_my_courses(db, user.id)
    avatar = await upload_repository.get_latest_avatar_for_user(db, user.id)
    updates: dict = {"course_codes": course_codes}
    if avatar is not None:
        updates["avatar_file_id"] = avatar.id
        updates["avatar_scan_status"] = avatar.scan_status
    return profile.model_copy(update=updates)


async def _followable_tag(db: AsyncSession, tag_id: int) -> Tag:
    tag = await tag_repository.get_by_id(db, tag_id)
    if tag is None:
        raise NotFoundError("Tag not found")
    if tag.tag_type == "school":
        raise ForbiddenError("School tags can only be added via verification")
    if tag.tag_type not in FOLLOWABLE_TYPES:
        raise ValidationError("This tag cannot be followed")
    return tag


async def update_profile(db: AsyncSession, user: User, payload: ProfileUpdateIn) -> UserProfileOut:
    if payload.date_of_birth is not None:
        validation_error = validate_date_of_birth(payload.date_of_birth, min_age_years=settings.MIN_AGE_YEARS, max_age_years=120)
        if validation_error:
            raise ValidationError(validation_error)
    if payload.feed_radius_meters is not None:
        if payload.feed_radius_meters < settings.MIN_RADIUS_METERS:
            raise ValidationError(f"feed_radius_meters must be at least {settings.MIN_RADIUS_METERS}")
        if payload.feed_radius_meters > settings.MAX_FEED_RADIUS_METERS:
            raise ValidationError(f"feed_radius_meters cannot exceed {settings.MAX_FEED_RADIUS_METERS}")

    location_update = {}
    if payload.latitude is not None and payload.longitude is not None:
        location_update["location"] = f"SRID=4326;POINT({payload.longitude} {payload.latitude})"

    await user_repository.update_fields(
        db,
        user,
        display_name=payload.display_name,
        date_of_birth=payload.date_of_birth,
        location_label=payload.location_label,
        feed_radius_meters=payload.feed_radius_meters,
        discoverable_in_broadcasts=payload.discoverable_in_broadcasts,
        **location_update,
    )

    if payload.nationality_tag_ids is not None or payload.hobby_tag_ids is not None:
        new_tag_ids = list(dict.fromkeys((payload.nationality_tag_ids or []) + (payload.hobby_tag_ids or [])))
        school_ids = await user_repository.school_tag_ids(db, user.id)
        await user_repository.replace_tags(db, user.id, [*school_ids, *new_tag_ids])

    await db.commit()
    return await _load_profile(db, user.id)


async def follow_tag(db: AsyncSession, user_id: uuid.UUID, tag_id: int, notifications_enabled: bool) -> None:
    tag = await _followable_tag(db, tag_id)
    user = await user_repository.get_by_id(db, user_id)
    if user is None:
        raise NotFoundError("User not found")
    if tag.tag_type == "region" and not can_follow_region_tags(user):
        raise ValidationError(REGION_TAGS_LOCKED_MESSAGE)
    if not user.is_admin:
        current_ids = await user_repository.list_followed_tag_ids(db, user_id, FOLLOWABLE_TYPES)
        if tag_id not in current_ids and len(current_ids) >= followed_tag_limit(user.account_type):
            raise ValidationError(_tag_limit_message(user.account_type))
    await user_repository.follow_and_own(db, user_id, tag_id, notifications_enabled)
    await db.commit()


async def get_profile_with_tags(db: AsyncSession, user_id: uuid.UUID) -> UserProfileOut:
    return await _load_profile(db, user_id)


async def list_identity_tags(db: AsyncSession, user_id: uuid.UUID) -> list[Tag]:
    """Same tag set as GET /users/me `tags` (owned + followed)."""
    user = await user_repository.get_by_id_with_tags(db, user_id)
    if user is None:
        return []
    return _identity_tags(user)


async def unfollow_tag(db: AsyncSession, user_id: uuid.UUID, tag_id: int) -> None:
    tag = await tag_repository.get_by_id(db, tag_id)
    if tag is not None and tag.tag_type == "school":
        raise ForbiddenError("School tags can only be added via verification")
    await user_repository.unfollow_and_disown(db, user_id, tag_id)
    await db.commit()


def _tag_limit_message(account_type: str) -> str:
    limit = followed_tag_limit(account_type)
    if limit <= settings.FOLLOWED_TAG_LIMIT_DEFAULT:
        return (
            f"You've used all {limit} free tags. Deselect one to add another "
            "— school and course tags don't count."
        )
    return f"You've used all {limit} tags. Deselect one to add another."


async def _drop_locked_region_tags(db: AsyncSession, user: User) -> bool:
    if can_follow_region_tags(user):
        return False
    region_ids = await user_repository.list_identity_tag_ids_of_types(db, user.id, ("region",))
    if not region_ids:
        return False
    for tag_id in region_ids:
        await user_repository.unfollow_and_disown(db, user.id, tag_id)
    return True


async def get_followed_tag_ids(db: AsyncSession, user_id: uuid.UUID) -> list[int]:
    user = await user_repository.get_by_id(db, user_id)
    if user is None:
        raise NotFoundError("User not found")
    dropped = await _drop_community_tags(db, user.id)
    dropped = await _drop_locked_region_tags(db, user) or dropped
    if dropped:
        await db.commit()
    return await user_repository.list_followed_tag_ids(db, user_id, FOLLOWABLE_TYPES)


async def replace_followed_tags(db: AsyncSession, user_id: uuid.UUID, payload: FollowedTagsReplaceIn) -> list[int]:
    if payload.school:
        raise ForbiddenError("School tags can only be added via verification")

    user = await user_repository.get_by_id(db, user_id)
    if user is None:
        raise NotFoundError("User not found")

    allow_region = can_follow_region_tags(user)
    if payload.region and not allow_region:
        raise ValidationError(REGION_TAGS_LOCKED_MESSAGE)

    ordered_ids: list[int] = []
    seen: set[int] = set()
    for tag_type in FOLLOWABLE_TYPES:
        if tag_type == "region" and not allow_region:
            continue
        for tag_id in getattr(payload, tag_type):
            if tag_id in seen:
                continue
            seen.add(tag_id)
            ordered_ids.append(tag_id)

    if not user.is_admin and len(ordered_ids) > followed_tag_limit(user.account_type):
        raise ValidationError(_tag_limit_message(user.account_type))

    tags = await tag_repository.get_by_ids(db, ordered_ids)
    by_id = {tag.id: tag for tag in tags}
    if len(by_id) != len(ordered_ids):
        raise NotFoundError("Tag not found")

    for tag_type in FOLLOWABLE_TYPES:
        if tag_type == "region" and not allow_region:
            continue
        for tag_id in getattr(payload, tag_type):
            if by_id[tag_id].tag_type != tag_type:
                raise ValidationError(f"Tag {tag_id} is not a {tag_type} tag")

    await user_repository.replace_followed_tags(db, user_id, ordered_ids)
    await db.commit()
    return await user_repository.list_followed_tag_ids(db, user_id, FOLLOWABLE_TYPES)
