"""soft delete + per-viewer hide for messages

Revision ID: 0036
Revises: 0035
Create Date: 2026-10-12
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0036"
down_revision = "0035"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("messages", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.create_table(
        "hidden_messages",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("message_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("messages.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("hidden_messages")
    op.drop_column("messages", "deleted_at")
