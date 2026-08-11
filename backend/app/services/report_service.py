import uuid
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.report import Report
from app.repositories import broadcast_repository, conversation_repository, report_repository, user_repository
from app.services.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationError


async def _assert_target_exists(db: AsyncSession, *, target_type: str, target_id: uuid.UUID, reporter_id: uuid.UUID) -> None:
    if target_type == "broadcast":
        target = await broadcast_repository.get_by_id(db, target_id)
        if target is None:
            raise NotFoundError("Broadcast not found")
        return

    if target_type == "message":
        target = await conversation_repository.get_message_by_id(db, target_id)
        if target is None:
            raise NotFoundError("Message not found")
        return

    if target_type == "user":
        target = await user_repository.get_by_id(db, target_id)
        if target is None:
            raise NotFoundError("User not found")
        if target.id == reporter_id:
            raise ValidationError("You cannot report your own profile")
        return

    raise ValidationError("Unsupported target type")


async def create_report(
    db: AsyncSession,
    *,
    reporter_id: uuid.UUID,
    target_type: str,
    target_id: uuid.UUID,
    reason: str,
    details: str | None,
) -> Report:
    await _assert_target_exists(db, target_type=target_type, target_id=target_id, reporter_id=reporter_id)
    report = await report_repository.create_report(
        db,
        reporter_id=reporter_id,
        target_type=target_type,
        target_id=target_id,
        reason=reason,
        details=details,
    )
    await db.commit()
    await db.refresh(report)
    return report


def _target_preview(report: Report) -> str:
    details = (report.details or "").strip()
    if details:
        return details[:120]
    return f"{report.target_type}:{report.target_id}"


async def list_reports_for_queue(db: AsyncSession, *, status: str, limit: int, offset: int) -> list[dict]:
    reports = await report_repository.list_by_status(db, status=status, limit=limit, offset=offset)
    queue_items: list[dict] = []
    for report in reports:
        if report.reporter is None:
            continue
        queue_items.append(
            {
                "id": report.id,
                "status": report.status,
                "reason": report.reason,
                "details": report.details,
                "created_at": report.created_at,
                "reporter": report.reporter,
                "target_type": report.target_type,
                "target_id": report.target_id,
                "target_preview": _target_preview(report),
            }
        )
    return queue_items


async def _target_user_id_for_report(db: AsyncSession, report: Report) -> uuid.UUID:
    if report.target_type == "user":
        return report.target_id

    if report.target_type == "broadcast":
        broadcast = await broadcast_repository.get_by_id(db, report.target_id)
        if broadcast is None:
            raise NotFoundError("Target broadcast no longer exists")
        return broadcast.sender_id

    if report.target_type == "message":
        message = await conversation_repository.get_message_by_id(db, report.target_id)
        if message is None:
            raise NotFoundError("Target message no longer exists")
        return message.sender_id

    raise ValidationError("Unsupported target type")


async def resolve_report(
    db: AsyncSession,
    *,
    report_id: uuid.UUID | str,
    action: str,
    resolution_notes: str | None,
    admin_user_id: uuid.UUID,
) -> Report:
    report = await report_repository.get_by_id(db, report_id)
    if report is None:
        raise NotFoundError("Report not found")
    if report.status != "pending":
        raise ConflictError("Report already resolved")

    normalized_notes = resolution_notes.strip() if resolution_notes else None
    now = datetime.now(UTC)

    if action == "dismiss":
        await report_repository.mark_resolved(
            db,
            report,
            status="dismissed",
            reviewed_by=admin_user_id,
            reviewed_at=now,
            resolution_notes=normalized_notes,
        )
    elif action == "suspend_user":
        target_user_id = await _target_user_id_for_report(db, report)
        target_user = await user_repository.get_by_id(db, target_user_id)
        if target_user is None:
            raise NotFoundError("Target user not found")
        if target_user.is_admin:
            raise ForbiddenError("Cannot suspend an admin user")
        await user_repository.suspend_user(db, target_user, normalized_notes or report.reason, now)
        await report_repository.mark_resolved(
            db,
            report,
            status="actioned",
            reviewed_by=admin_user_id,
            reviewed_at=now,
            resolution_notes=normalized_notes,
        )
    else:
        raise ValidationError("Unsupported resolution action")

    await db.commit()
    await db.refresh(report)
    return report
