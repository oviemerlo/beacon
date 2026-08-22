"""add school verification

Revision ID: 0006
Revises: 0005
Create Date: 2026-08-19
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "schools",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("country", sa.String(length=100), nullable=True),
        sa.Column("email_domains", postgresql.ARRAY(sa.String()), nullable=False),
        sa.UniqueConstraint("name", "country", name="uq_school_name_country"),
    )

    op.create_table(
        "school_verifications",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, nullable=False),
        sa.Column("school_id", sa.Integer(), sa.ForeignKey("schools.id"), nullable=False),
        sa.Column("school_email", sa.String(length=255), nullable=False),
        sa.Column("otp_code_hash", sa.String(length=255), nullable=False),
        sa.Column("otp_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("otp_attempts", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("school_verifications")
    op.drop_table("schools")
