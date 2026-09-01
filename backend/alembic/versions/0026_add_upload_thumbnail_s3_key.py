"""add uploaded_files thumbnail_s3_key

Revision ID: 0026
Revises: 0025
Create Date: 2026-09-01
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0026"
down_revision: str | Sequence[str] | None = "0025"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("uploaded_files", sa.Column("thumbnail_s3_key", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("uploaded_files", "thumbnail_s3_key")
