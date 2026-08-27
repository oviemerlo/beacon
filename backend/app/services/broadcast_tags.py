"""How echo audience tags are shown to the viewer.

Senders see the tags they targeted. Receivers see the tag they actually
hold: a country when they don't follow the region, or the region when they
don't follow the country.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.broadcast import Broadcast
from app.models.tag import Tag
from app.repositories import broadcast_repository
from app.services import user_service
from app.services.regions import get_countries_for_region, get_region_for_country_name


def tag_payload(tag: Tag) -> dict:
    return {"id": tag.id, "tag_type": tag.tag_type, "label": tag.label}


def echo_tags_for_viewer(broadcast: Broadcast, viewer_id, viewer_tags: list[Tag]) -> list[Tag]:
    raw = [row.tag for row in broadcast.tags if row.tag is not None]
    if broadcast.sender_id == viewer_id:
        return raw

    viewer_regions = {tag.label: tag for tag in viewer_tags if tag.tag_type == "region"}
    viewer_nationalities = [tag for tag in viewer_tags if tag.tag_type == "nationality"]
    viewer_nationality_labels = {tag.label for tag in viewer_nationalities}

    visible: dict[int, Tag] = {}
    for tag in raw:
        if tag.tag_type == "region":
            if tag.label in viewer_regions:
                visible[tag.id] = tag
                continue
            countries = set(get_countries_for_region(tag.label))
            for nationality in viewer_nationalities:
                if nationality.label in countries:
                    visible[nationality.id] = nationality
            continue

        if tag.tag_type == "nationality":
            if tag.label in viewer_nationality_labels:
                visible[tag.id] = tag
                continue
            region_label = get_region_for_country_name(tag.label)
            region_tag = viewer_regions.get(region_label) if region_label else None
            if region_tag is not None:
                visible[region_tag.id] = region_tag
                continue

        visible[tag.id] = tag
    return list(visible.values())


def serialize_echo(
    broadcast: Broadcast,
    *,
    viewer_id,
    viewer_tags: list[Tag],
    distance_m,
    reply_count: int = 0,
    shared_tag_count=None,
) -> dict:
    return {
        "id": str(broadcast.id),
        "sender_id": str(broadcast.sender_id),
        "sender_display_name": broadcast.sender.display_name if broadcast.sender is not None else "Unknown",
        "sender_is_verified": bool(broadcast.sender is not None and broadcast.sender.is_verified),
        "content": broadcast.content,
        "distance_m": round(float(distance_m or 0), 1),
        "shared_tag_count": shared_tag_count,
        "tags": [tag_payload(tag) for tag in echo_tags_for_viewer(broadcast, viewer_id, viewer_tags)],
        "is_global": broadcast.is_global,
        "radius_meters": broadcast.radius_meters,
        "course_code": broadcast.course_code,
        "created_at": broadcast.created_at,
        "last_activity_at": broadcast.created_at,
        "reply_count": int(reply_count or 0),
        "latest_reply": None,
    }


def serialize_echo_row(row, viewer_id, viewer_tags: list[Tag]) -> dict:
    broadcast, distance_m, *rest = row
    if len(rest) == 2:
        shared_tag_count, reply_count = rest
    else:
        shared_tag_count, reply_count = None, rest[0]
    return serialize_echo(
        broadcast,
        viewer_id=viewer_id,
        viewer_tags=viewer_tags,
        distance_m=distance_m,
        reply_count=reply_count,
        shared_tag_count=shared_tag_count,
    )


async def serialize_echo_rows(db: AsyncSession, viewer_id, rows) -> list[dict]:
    viewer_tags = await user_service.list_identity_tags(db, viewer_id)
    cards = [serialize_echo_row(row, viewer_id, viewer_tags) for row in rows]
    parent_ids = [row[0].id for row in rows]
    latest_by_parent = await broadcast_repository.latest_visible_replies_by_parent(db, viewer_id, parent_ids)
    for card, row in zip(cards, rows):
        reply = latest_by_parent.get(row[0].id)
        if reply is None:
            continue
        card["last_activity_at"] = reply.created_at
        card["latest_reply"] = {
            "id": str(reply.id),
            "sender_id": str(reply.sender_id),
            "sender_display_name": reply.sender.display_name if reply.sender is not None else "Unknown",
            "sender_is_verified": bool(reply.sender is not None and reply.sender.is_verified),
            "content": reply.content,
            "created_at": reply.created_at,
        }
    return cards


def serialize_search_hit(hit, viewer_id, viewer_tags: list[Tag]) -> dict:
    card = serialize_echo(
        hit.broadcast,
        viewer_id=viewer_id,
        viewer_tags=viewer_tags,
        distance_m=0,
        reply_count=0,
    )
    return {
        "id": card["id"],
        "body": card["content"],
        "created_at": card["created_at"],
        "match_type": hit.match_type,
        "sender_id": card["sender_id"],
        "sender_display_name": card["sender_display_name"],
        "sender_is_verified": card["sender_is_verified"],
        "tags": card["tags"],
        "matches": [
            {
                "id": str(match.id),
                "body": match.body,
                "created_at": match.created_at,
                "source": match.source,
                "conversation_id": str(match.conversation_id) if match.conversation_id else None,
                "sender_display_name": match.sender_display_name,
                "sender_id": str(match.sender_id) if match.sender_id else None,
            }
            for match in hit.matches
        ],
    }
