"""Profile read/update and tag-follow business logic."""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.age import validate_date_of_birth
from app.utils.config import settings
from app.models.user import User
from app.repositories import tag_repository, user_repository
from app.schemas.schemas import ProfileUpdateIn
from app.services.exceptions import ForbiddenError, NotFoundError, ValidationError


async def update_profile(db: AsyncSession, user: User, payload: ProfileUpdateIn) -> User:
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
        new_tag_ids = (payload.nationality_tag_ids or []) + (payload.hobby_tag_ids or [])
        await user_repository.replace_tags(db, user.id, new_tag_ids)

    await db.commit()
    hydrated = await user_repository.get_by_id_with_tags(db, user.id)
    return hydrated or user

async def follow_tag(db: AsyncSession, user_id: uuid.UUID, tag_id: int, notifications_enabled: bool) -> None:
    tag = await tag_repository.get_by_id(db, tag_id)
    if tag is None:
        raise NotFoundError("Tag not found")
    if tag.tag_type == "school":
        raise ForbiddenError("School tags can only be added via verification")
    await user_repository.follow_tag(db, user_id, tag_id, notifications_enabled)
    await db.commit()

async def get_profile_with_tags(db: AsyncSession, user_id: uuid.UUID) -> User:
    """Used by GET /users/me — needs tags eager-loaded for the response model."""
    user = await user_repository.get_by_id_with_tags(db, user_id)
    if user is None:
        raise NotFoundError("User not found")
    return user


async def unfollow_tag(db: AsyncSession, user_id: uuid.UUID, tag_id: int) -> None:
    await user_repository.unfollow_tag(db, user_id, tag_id)
    await db.commit()


async def get_followed_tag_ids(db: AsyncSession, user_id: uuid.UUID) -> list[int]:
    return await user_repository.list_followed_tag_ids(db, user_id)
