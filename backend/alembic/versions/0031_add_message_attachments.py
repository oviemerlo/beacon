"""add message attachments on uploaded_files

Revision ID: 0031
Revises: 0030
Create Date: 2026-09-14
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0031"
down_revision: str | Sequence[str] | None = "0030"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "uploaded_files",
        sa.Column("message_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_uploaded_files_message_id",
        "uploaded_files",
        "messages",
        ["message_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.drop_constraint("ck_uploaded_files_context", "uploaded_files", type_="check")
    op.create_check_constraint(
        "ck_uploaded_files_context",
        "uploaded_files",
        "context IN ('avatar', 'broadcast_attachment', 'message_attachment')",
    )
    op.drop_constraint("ck_uploaded_files_broadcast_id", "uploaded_files", type_="check")
    op.create_check_constraint(
        "ck_uploaded_files_context_parent",
        "uploaded_files",
        "(context = 'avatar' AND broadcast_id IS NULL AND message_id IS NULL) OR "
        "(context = 'broadcast_attachment' AND broadcast_id IS NOT NULL AND message_id IS NULL) OR "
        "(context = 'message_attachment' AND message_id IS NOT NULL AND broadcast_id IS NULL)",
    )


def downgrade() -> None:
    op.drop_constraint("ck_uploaded_files_context_parent", "uploaded_files", type_="check")
    op.create_check_constraint(
        "ck_uploaded_files_broadcast_id",
        "uploaded_files",
        "(context = 'avatar' AND broadcast_id IS NULL) OR "
        "(context = 'broadcast_attachment' AND broadcast_id IS NOT NULL)",
    )
    op.drop_constraint("ck_uploaded_files_context", "uploaded_files", type_="check")
    op.create_check_constraint(
        "ck_uploaded_files_context",
        "uploaded_files",
        "context IN ('avatar', 'broadcast_attachment')",
    )
    op.drop_constraint("fk_uploaded_files_message_id", "uploaded_files", type_="foreignkey")
    op.drop_column("uploaded_files", "message_id")
