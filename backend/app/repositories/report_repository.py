"""Data access for moderation reports."""

import uuid
from datetime import datetime

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.report import Report


async def create_report(
    db: AsyncSession,
    *,
    reporter_id: uuid.UUID,
    target_type: str,
    target_id: uuid.UUID,
    reason: str,
    details: str | None,
) -> Report:
    report = Report(
        reporter_id=reporter_id,
        target_type=target_type,
        target_id=target_id,
        reason=reason,
        details=details,
        status="pending",
    )
    db.add(report)
    await db.flush()
    return report


async def get_by_id(db: AsyncSession, report_id: uuid.UUID | str) -> Report | None:
    result = await db.execute(
        select(Report)
        .where(Report.id == report_id)
        .options(selectinload(Report.reporter), selectinload(Report.reviewer))
    )
    return result.scalar_one_or_none()


async def list_by_status(db: AsyncSession, status: str, limit: int, offset: int) -> list[Report]:
    result = await db.execute(
        select(Report)
        .where(Report.status == status)
        .options(selectinload(Report.reporter), selectinload(Report.reviewer))
        .order_by(desc(Report.created_at))
        .limit(limit)
        .offset(offset)
    )
    return list(result.scalars().all())


async def mark_resolved(
    db: AsyncSession,
    report: Report,
    *,
    status: str,
    reviewed_by: uuid.UUID,
    reviewed_at: datetime,
    resolution_notes: str | None,
) -> Report:
    report.status = status
    report.reviewed_by = reviewed_by
    report.reviewed_at = reviewed_at
    report.resolution_notes = resolution_notes
    await db.flush()
    return report


async def count_for_target(db: AsyncSession, *, target_type: str, target_id: uuid.UUID) -> int:
    result = await db.execute(
        select(Report.id).where(Report.target_type == target_type, Report.target_id == target_id, Report.status == "pending")
    )
    return len(result.scalars().all())
