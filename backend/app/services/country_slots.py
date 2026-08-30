"""Country community slots and the 30-day per-slot change window."""

from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.utils.config import settings
from app.services.exceptions import ValidationError


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def resolve_plan(user: User) -> str:
    if user.is_admin or user.account_type == "business":
        return "amplify"
    if user.is_verified:
        return "campus"
    return "free"


def country_slot_limit(user: User) -> int | None:
    """None means unlimited countries and no change window (Amplify / admin)."""
    if user.is_admin:
        return None
    plan = resolve_plan(user)
    if plan == "amplify":
        return None
    if plan in ("campus", "connect"):
        return settings.COUNTRY_SLOT_LIMIT_PAID
    return settings.COUNTRY_SLOT_LIMIT_FREE


def next_change_at(changed_at: datetime | None) -> datetime | None:
    if changed_at is None:
        return None
    return changed_at + timedelta(days=settings.COUNTRY_SLOT_CHANGE_DAYS)


def slot_is_locked(changed_at: datetime | None, now: datetime | None = None) -> bool:
    nxt = next_change_at(changed_at)
    if nxt is None:
        return False
    return (now or utcnow()) < nxt


def format_next_change(changed_at: datetime) -> str:
    when = next_change_at(changed_at)
    if when is None:
        return ""
    return f"{when.strftime('%B')} {when.day}"


def change_locked_message(changed_at: datetime) -> str:
    return f"You can change this country community again on {format_next_change(changed_at)}."


def country_limit_message(limit: int) -> str:
    if limit == 1:
        return (
            "You've reached your 1-country limit. "
            "You can replace this community once the 30-day change window ends."
        )
    return (
        f"You've reached your {limit}-country limit. "
        "Replace a community that is not in its 30-day change window, "
        "or upgrade to Amplify for regional communities."
    )


def read_slots(user: User) -> list[dict]:
    return [
        {"slot": 1, "tag_id": user.country_slot_1_tag_id, "changed_at": user.country_slot_1_changed_at},
        {"slot": 2, "tag_id": user.country_slot_2_tag_id, "changed_at": user.country_slot_2_changed_at},
    ]


def write_slots(user: User, slots: list[dict]) -> None:
    by_slot = {item["slot"]: item for item in slots}
    one = by_slot.get(1, {"tag_id": None, "changed_at": None})
    two = by_slot.get(2, {"tag_id": None, "changed_at": None})
    user.country_slot_1_tag_id = one.get("tag_id")
    user.country_slot_1_changed_at = one.get("changed_at")
    user.country_slot_2_tag_id = two.get("tag_id")
    user.country_slot_2_changed_at = two.get("changed_at")


def serialize_slots(user: User) -> list[dict]:
    limit = country_slot_limit(user)
    if limit is None:
        return []
    now = utcnow()
    out = []
    for item in read_slots(user)[:limit]:
        changed_at = item["changed_at"]
        nxt = next_change_at(changed_at)
        out.append(
            {
                "slot": item["slot"],
                "tag_id": item["tag_id"],
                "changed_at": changed_at,
                "next_change_at": nxt,
                "locked": slot_is_locked(changed_at, now),
            }
        )
    return out


def apply_country_slot_changes(user: User, new_tag_ids: list[int], now: datetime | None = None) -> None:
    """Assign country follows to slots and enforce the per-slot change window."""
    limit = country_slot_limit(user)
    if limit is None:
        return

    desired = list(dict.fromkeys(new_tag_ids))
    if len(desired) > limit:
        raise ValidationError(country_limit_message(limit))

    now = now or utcnow()
    slots = read_slots(user)[:limit]
    current_ids = {item["tag_id"] for item in slots if item["tag_id"] is not None}
    desired_set = set(desired)
    removed = current_ids - desired_set
    added = [tag_id for tag_id in desired if tag_id not in current_ids]

    for item in slots:
        if item["tag_id"] in removed and slot_is_locked(item["changed_at"], now):
            raise ValidationError(change_locked_message(item["changed_at"]))

    next_slots = []
    for item in slots:
        if item["tag_id"] in desired_set:
            next_slots.append(item)
        else:
            next_slots.append({**item, "tag_id": None})

    added_iter = iter(added)
    for item in next_slots:
        if item["tag_id"] is not None:
            continue
        try:
            tag_id = next(added_iter)
        except StopIteration:
            continue
        if slot_is_locked(item["changed_at"], now):
            raise ValidationError(change_locked_message(item["changed_at"]))
        item["tag_id"] = tag_id
        item["changed_at"] = now

    leftover = list(added_iter)
    if leftover:
        raise ValidationError(country_limit_message(limit))

    if limit == 1:
        write_slots(user, next_slots + [{"slot": 2, "tag_id": None, "changed_at": user.country_slot_2_changed_at}])
    else:
        write_slots(user, next_slots)


async def reconcile_country_slots(db: AsyncSession, user: User, nationality_ids: list[int]) -> list[int]:
    """
    Align slot columns with followed nationality tags.
    Drops follows that exceed the plan's slot count. Does not start a cooldown.
    """
    from app.repositories import user_repository

    limit = country_slot_limit(user)
    if limit is None:
        return nationality_ids

    slots = read_slots(user)[:limit]
    followed = list(dict.fromkeys(nationality_ids))
    followed_set = set(followed)

    for item in slots:
        if item["tag_id"] is not None and item["tag_id"] not in followed_set:
            item["tag_id"] = None

    assigned = {item["tag_id"] for item in slots if item["tag_id"] is not None}
    extras = [tag_id for tag_id in followed if tag_id not in assigned]

    for item in slots:
        if item["tag_id"] is None and extras:
            item["tag_id"] = extras.pop(0)

    if limit == 1:
        write_slots(user, slots + [{"slot": 2, "tag_id": None, "changed_at": user.country_slot_2_changed_at}])
    else:
        write_slots(user, slots)

    kept = [item["tag_id"] for item in slots if item["tag_id"] is not None]
    kept_set = set(kept)
    for extra_id in extras:
        await user_repository.unfollow_and_disown(db, user.id, extra_id)
    return [tag_id for tag_id in nationality_ids if tag_id in kept_set]
