"""quarterly school reverification columns

Revision ID: 0013
Revises: 0012
Create Date: 2026-08-23 19:45:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0013"
down_revision: str | Sequence[str] | None = "0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("school_verifications", sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "school_verifications",
        sa.Column("reverification_reminder_sent_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_school_verifications_expires_at", "school_verifications", ["expires_at"])
    op.execute(
        """
        UPDATE school_verifications
        SET expires_at = verified_at + INTERVAL '3 months'
        WHERE verified_at IS NOT NULL
        """
    )
    op.execute(
        """
        UPDATE users
        SET is_verified = TRUE
        WHERE id IN (
            SELECT user_id FROM school_verifications
            WHERE verified_at IS NOT NULL
              AND expires_at > NOW()
        )
        """
    )


def downgrade() -> None:
    op.drop_index("ix_school_verifications_expires_at", table_name="school_verifications")
    op.drop_column("school_verifications", "reverification_reminder_sent_at")
    op.drop_column("school_verifications", "expires_at")
