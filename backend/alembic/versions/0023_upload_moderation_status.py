"""upload image moderation status

Revision ID: 0023
Revises: 0022
Create Date: 2026-08-30
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0023"
down_revision: str | Sequence[str] | None = "0022"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "uploaded_files",
        sa.Column("moderation_status", sa.String(length=20), nullable=False, server_default="pending"),
    )
    op.add_column("uploaded_files", sa.Column("moderation_labels", sa.Text(), nullable=True))
    op.create_index("ix_uploaded_files_moderation_status", "uploaded_files", ["moderation_status"])
    op.create_check_constraint(
        "ck_uploaded_files_moderation_status",
        "uploaded_files",
        "moderation_status IN ('pending', 'clean', 'flagged', 'rejected')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_uploaded_files_moderation_status", "uploaded_files", type_="check")
    op.drop_index("ix_uploaded_files_moderation_status", table_name="uploaded_files")
    op.drop_column("uploaded_files", "moderation_labels")
    op.drop_column("uploaded_files", "moderation_status")
