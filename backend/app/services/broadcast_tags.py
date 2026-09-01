"""How echo audience tags are shown to the viewer.

Senders see the tags they targeted. Receivers see the tag they actually
hold: a country when they don't follow the region, or the region when they
don't follow the country.
"""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.broadcast import Broadcast
from app.models.tag import Tag
from app.repositories import broadcast_repository, link_preview_repository, upload_repository
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
        "sender_avatar_file_id": None,
        "content": broadcast.content,
        "distance_m": round(float(distance_m or 0), 1),
        "shared_tag_count": shared_tag_count,
        "tags": [tag_payload(tag) for tag in echo_tags_for_viewer(broadcast, viewer_id, viewer_tags)],
        "is_global": broadcast.is_global,
        "radius_meters": broadcast.radius_meters,
        "course_code": broadcast.course_code,
        "course_codes": [broadcast.course_code] if broadcast.course_code else [],
        "created_at": broadcast.created_at,
        "last_activity_at": broadcast.created_at,
        "reply_count": int(reply_count or 0),
        "latest_reply": None,
        "attachments": [],
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


def _avatar_id(avatars: dict, user_id) -> str | None:
    file_id = avatars.get(user_id)
    return str(file_id) if file_id else None


def _course_codes_for(broadcast: Broadcast, loaded: list[str] | None = None) -> list[str]:
    codes = list(loaded or [])
    if not codes and broadcast.course_code:
        codes = [broadcast.course_code]
    return codes


async def attach_course_codes(db: AsyncSession, cards: list[dict], broadcasts: list[Broadcast]) -> None:
    loaded = await broadcast_repository.list_course_codes_by_broadcast_ids(db, [broadcast.id for broadcast in broadcasts])
    for card, broadcast in zip(cards, broadcasts):
        codes = _course_codes_for(broadcast, loaded.get(broadcast.id))
        card["course_codes"] = codes
        card["course_code"] = codes[0] if codes else None


async def attach_sender_avatars(db: AsyncSession, cards: list[dict], broadcasts: list[Broadcast]) -> None:
    avatars = await upload_repository.latest_clean_avatar_ids_for_users(db, [broadcast.sender_id for broadcast in broadcasts])
    for card, broadcast in zip(cards, broadcasts):
        card["sender_avatar_file_id"] = _avatar_id(avatars, broadcast.sender_id)


def _attachment_payloads(rows) -> list[dict]:
    return [
        {
            "file_id": str(row.id),
            "original_filename": row.original_filename,
            "content_type": row.content_type,
            "has_thumbnail": row.thumbnail_s3_key is not None,
        }
        for row in rows
    ]


async def attach_broadcast_attachments(db: AsyncSession, cards: list[dict], broadcasts: list[Broadcast]) -> None:
    by_id = await upload_repository.list_clean_attachments_for_broadcasts(db, [broadcast.id for broadcast in broadcasts])
    for card, broadcast in zip(cards, broadcasts):
        card["attachments"] = _attachment_payloads(by_id.get(broadcast.id, []))


def _link_preview_payload(preview) -> dict:
    return {
        "id": preview.id,
        "normalized_url": preview.normalized_url,
        "title": preview.title,
        "description": preview.description,
        "image_url": preview.image_url,
        "site_name": preview.site_name,
        "favicon_url": preview.favicon_url,
        "status": preview.status,
    }


async def attach_link_previews(db: AsyncSession, cards: list[dict], broadcasts: list[Broadcast]) -> None:
    ids = [b.id for b in broadcasts]
    reply_ids = [uuid.UUID(str(card["latest_reply"]["id"])) for card in cards if card.get("latest_reply")]
    by_id = await link_preview_repository.list_ok_for_broadcasts(db, ids + reply_ids)
    for card, broadcast in zip(cards, broadcasts):
        card["link_previews"] = [_link_preview_payload(p) for p in by_id.get(broadcast.id, [])]
        latest = card.get("latest_reply")
        if latest is not None:
            latest["link_previews"] = [_link_preview_payload(p) for p in by_id.get(uuid.UUID(str(latest["id"])), [])]


async def serialize_echo_rows(db: AsyncSession, viewer_id, rows) -> list[dict]:
    viewer_tags = await user_service.list_identity_tags(db, viewer_id)
    cards = [serialize_echo_row(row, viewer_id, viewer_tags) for row in rows]
    broadcasts = [row[0] for row in rows]
    await attach_broadcast_attachments(db, cards, broadcasts)
    await attach_course_codes(db, cards, broadcasts)
    parent_ids = [row[0].id for row in rows]
    latest_by_parent = await broadcast_repository.latest_visible_replies_by_parent(db, viewer_id, parent_ids)
    reply_attachments = await upload_repository.list_clean_attachments_for_broadcasts(
        db, [reply.id for reply in latest_by_parent.values()]
    )
    avatar_user_ids = [broadcast.sender_id for broadcast in broadcasts]
    avatar_user_ids.extend(reply.sender_id for reply in latest_by_parent.values())
    avatars = await upload_repository.latest_clean_avatar_ids_for_users(db, avatar_user_ids)
    for card, broadcast in zip(cards, broadcasts):
        card["sender_avatar_file_id"] = _avatar_id(avatars, broadcast.sender_id)
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
            "sender_avatar_file_id": _avatar_id(avatars, reply.sender_id),
            "content": reply.content,
            "created_at": reply.created_at,
            "attachments": _attachment_payloads(reply_attachments.get(reply.id, [])),
        }
    await attach_link_previews(db, cards, broadcasts)
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
        "sender_avatar_file_id": card["sender_avatar_file_id"],
        "tags": card["tags"],
        "course_code": card["course_code"],
        "course_codes": card["course_codes"],
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
