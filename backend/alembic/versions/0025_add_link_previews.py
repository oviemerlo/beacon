"""add link previews

Revision ID: 0025
Revises: 0024
Create Date: 2026-09-01
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0025"
down_revision: str | Sequence[str] | None = "0024"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "link_previews",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("normalized_url", sa.String(length=2048), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("image_url", sa.String(length=2048), nullable=True),
        sa.Column("site_name", sa.String(length=200), nullable=True),
        sa.Column("favicon_url", sa.String(length=2048), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_link_previews_normalized_url", "link_previews", ["normalized_url"], unique=True)
    op.create_check_constraint(
        "ck_link_previews_status",
        "link_previews",
        "status IN ('ok', 'failed')",
    )
    op.create_table(
        "broadcast_link_previews",
        sa.Column("broadcast_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("broadcasts.id", ondelete="CASCADE"), primary_key=True, nullable=False),
        sa.Column("link_preview_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("link_previews.id", ondelete="CASCADE"), primary_key=True, nullable=False),
        sa.Column("sort_index", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_table(
        "message_link_previews",
        sa.Column("message_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("messages.id", ondelete="CASCADE"), primary_key=True, nullable=False),
        sa.Column("link_preview_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("link_previews.id", ondelete="CASCADE"), primary_key=True, nullable=False),
        sa.Column("sort_index", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_table("message_link_previews")
    op.drop_table("broadcast_link_previews")
    op.drop_constraint("ck_link_previews_status", "link_previews", type_="check")
    op.drop_index("ix_link_previews_normalized_url", table_name="link_previews")
    op.drop_table("link_previews")
