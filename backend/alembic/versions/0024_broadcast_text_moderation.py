"""broadcast text moderation status

Revision ID: 0024
Revises: 0023
Create Date: 2026-08-30
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0024"
down_revision: str | Sequence[str] | None = "0023"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "broadcasts",
        sa.Column("moderation_status", sa.String(length=20), nullable=False, server_default="pending"),
    )
    op.add_column("broadcasts", sa.Column("moderation_labels", sa.Text(), nullable=True))
    op.create_index("ix_broadcasts_moderation_status", "broadcasts", ["moderation_status"])
    op.create_check_constraint(
        "ck_broadcasts_moderation_status",
        "broadcasts",
        "moderation_status IN ('pending', 'clean', 'flagged', 'rejected')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_broadcasts_moderation_status", "broadcasts", type_="check")
    op.drop_index("ix_broadcasts_moderation_status", table_name="broadcasts")
    op.drop_column("broadcasts", "moderation_labels")
    op.drop_column("broadcasts", "moderation_status")
