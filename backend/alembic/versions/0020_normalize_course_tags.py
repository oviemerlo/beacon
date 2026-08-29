"""normalize duplicate course tag spellings

Revision ID: 0020
Revises: 0019
Create Date: 2026-08-28
"""

from collections.abc import Sequence

from alembic import op
from sqlalchemy import text

from app.utils.course_tags import canonical_course_tag

revision: str = "0020"
down_revision: str | Sequence[str] | None = "0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _canonical(value: str | None) -> str:
    return canonical_course_tag(value or "")


def upgrade() -> None:
    conn = op.get_bind()

    enrollments = conn.execute(text("SELECT user_id, school_id, course_code FROM user_course_enrollments")).fetchall()
    seen_enrollments: set[tuple] = set()
    for user_id, school_id, course_code in enrollments:
        canonical = _canonical(course_code)
        if not canonical:
            conn.execute(
                text("DELETE FROM user_course_enrollments WHERE user_id = :user_id AND school_id = :school_id AND course_code = :course_code"),
                {"user_id": user_id, "school_id": school_id, "course_code": course_code},
            )
            continue
        key = (str(user_id), school_id, canonical)
        if key in seen_enrollments or canonical == course_code:
            if key in seen_enrollments and canonical != course_code:
                conn.execute(
                    text("DELETE FROM user_course_enrollments WHERE user_id = :user_id AND school_id = :school_id AND course_code = :course_code"),
                    {"user_id": user_id, "school_id": school_id, "course_code": course_code},
                )
            seen_enrollments.add(key)
            continue
        existing = conn.execute(
            text("SELECT 1 FROM user_course_enrollments WHERE user_id = :user_id AND school_id = :school_id AND course_code = :course_code"),
            {"user_id": user_id, "school_id": school_id, "course_code": canonical},
        ).fetchone()
        if existing:
            conn.execute(
                text("DELETE FROM user_course_enrollments WHERE user_id = :user_id AND school_id = :school_id AND course_code = :course_code"),
                {"user_id": user_id, "school_id": school_id, "course_code": course_code},
            )
        else:
            conn.execute(
                text(
                    "UPDATE user_course_enrollments SET course_code = :canonical "
                    "WHERE user_id = :user_id AND school_id = :school_id AND course_code = :course_code"
                ),
                {"canonical": canonical, "user_id": user_id, "school_id": school_id, "course_code": course_code},
            )
        seen_enrollments.add(key)

    broadcast_courses = conn.execute(text("SELECT broadcast_id, course_code FROM broadcast_courses")).fetchall()
    seen_courses: set[tuple] = set()
    for broadcast_id, course_code in broadcast_courses:
        canonical = _canonical(course_code)
        if not canonical:
            conn.execute(
                text("DELETE FROM broadcast_courses WHERE broadcast_id = :broadcast_id AND course_code = :course_code"),
                {"broadcast_id": broadcast_id, "course_code": course_code},
            )
            continue
        key = (str(broadcast_id), canonical)
        if key in seen_courses:
            conn.execute(
                text("DELETE FROM broadcast_courses WHERE broadcast_id = :broadcast_id AND course_code = :course_code"),
                {"broadcast_id": broadcast_id, "course_code": course_code},
            )
            continue
        if canonical == course_code:
            seen_courses.add(key)
            continue
        existing = conn.execute(
            text("SELECT 1 FROM broadcast_courses WHERE broadcast_id = :broadcast_id AND course_code = :course_code"),
            {"broadcast_id": broadcast_id, "course_code": canonical},
        ).fetchone()
        if existing:
            conn.execute(
                text("DELETE FROM broadcast_courses WHERE broadcast_id = :broadcast_id AND course_code = :course_code"),
                {"broadcast_id": broadcast_id, "course_code": course_code},
            )
        else:
            conn.execute(
                text(
                    "UPDATE broadcast_courses SET course_code = :canonical "
                    "WHERE broadcast_id = :broadcast_id AND course_code = :course_code"
                ),
                {"canonical": canonical, "broadcast_id": broadcast_id, "course_code": course_code},
            )
        seen_courses.add(key)

    broadcasts = conn.execute(text("SELECT id, course_code FROM broadcasts WHERE course_code IS NOT NULL")).fetchall()
    for broadcast_id, course_code in broadcasts:
        canonical = _canonical(course_code)
        conn.execute(
            text("UPDATE broadcasts SET course_code = :canonical WHERE id = :broadcast_id"),
            {"canonical": canonical or None, "broadcast_id": broadcast_id},
        )


def downgrade() -> None:
    pass
