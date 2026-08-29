"""add uploaded_files

Revision ID: 0016
Revises: 0015
Create Date: 2026-08-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0016"
down_revision: str | Sequence[str] | None = "0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "uploaded_files",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "uploader_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("context", sa.String(length=40), nullable=False),
        sa.Column(
            "broadcast_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("broadcasts.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("s3_key", sa.String(length=500), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=100), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("scan_status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("s3_key", name="uq_uploaded_files_s3_key"),
        sa.CheckConstraint("context IN ('avatar', 'broadcast_attachment')", name="ck_uploaded_files_context"),
        sa.CheckConstraint(
            "scan_status IN ('pending', 'clean', 'infected', 'scan_failed')",
            name="ck_uploaded_files_scan_status",
        ),
        sa.CheckConstraint(
            "(context = 'avatar' AND broadcast_id IS NULL) OR "
            "(context = 'broadcast_attachment' AND broadcast_id IS NOT NULL)",
            name="ck_uploaded_files_broadcast_id",
        ),
    )
    op.create_index("ix_uploaded_files_scan_status", "uploaded_files", ["scan_status"])
    op.create_index("ix_uploaded_files_uploader_user_id", "uploaded_files", ["uploader_user_id"])


def downgrade() -> None:
    op.drop_index("ix_uploaded_files_uploader_user_id", table_name="uploaded_files")
    op.drop_index("ix_uploaded_files_scan_status", table_name="uploaded_files")
    op.drop_table("uploaded_files")
