"""add reports and moderation fields

Revision ID: 0004
Revises: 0003
Create Date: 2026-08-10
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("users", sa.Column("is_suspended", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("users", sa.Column("suspended_reason", sa.String(length=500), nullable=True))
    op.add_column("users", sa.Column("suspended_at", sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        "reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("reporter_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_type", sa.String(length=20), nullable=False),
        sa.Column("target_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reason", sa.String(length=40), nullable=False),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default=sa.text("'pending'")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolution_notes", sa.Text(), nullable=True),
    )
    op.create_index("ix_reports_status_created_at", "reports", ["status", "created_at"], unique=False)
    op.create_index("ix_reports_target_type_target_id", "reports", ["target_type", "target_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_reports_target_type_target_id", table_name="reports")
    op.drop_index("ix_reports_status_created_at", table_name="reports")
    op.drop_table("reports")
    op.drop_column("users", "suspended_at")
    op.drop_column("users", "suspended_reason")
    op.drop_column("users", "is_suspended")
    op.drop_column("users", "is_admin")
