"""message text moderation status

Revision ID: 0035
Revises: 0034
Create Date: 2026-10-11
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0035"
down_revision: str | Sequence[str] | None = "0034"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "messages",
        sa.Column("moderation_status", sa.String(length=20), nullable=False, server_default="pending"),
    )
    op.add_column("messages", sa.Column("moderation_labels", sa.Text(), nullable=True))
    op.create_index("ix_messages_moderation_status", "messages", ["moderation_status"])
    op.create_check_constraint(
        "ck_messages_moderation_status",
        "messages",
        "moderation_status IN ('pending', 'clean', 'flagged', 'rejected')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_messages_moderation_status", "messages", type_="check")
    op.drop_index("ix_messages_moderation_status", table_name="messages")
    op.drop_column("messages", "moderation_labels")
    op.drop_column("messages", "moderation_status")
