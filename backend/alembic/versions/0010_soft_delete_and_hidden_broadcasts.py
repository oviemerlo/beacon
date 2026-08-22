"""soft-delete broadcasts and per-user hidden_broadcasts

Revision ID: 0010
Revises: 0009
Create Date: 2026-08-21 20:14:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0010"
down_revision: str | Sequence[str] | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("broadcasts", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.create_table(
        "hidden_broadcasts",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column(
            "broadcast_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("broadcasts.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("hidden_broadcasts")
    op.drop_column("broadcasts", "deleted_at")
