"""broadcast course targeting rows

Revision ID: 0019
Revises: 0018
Create Date: 2026-08-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0019"
down_revision: str | Sequence[str] | None = "0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "broadcast_courses",
        sa.Column("broadcast_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("broadcasts.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("course_code", sa.String(length=30), primary_key=True),
    )
    op.execute(
        """
        INSERT INTO broadcast_courses (broadcast_id, course_code)
        SELECT id, course_code FROM broadcasts
        WHERE course_code IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_table("broadcast_courses")
