"""remove community tags

Revision ID: 0015
Revises: 0014
Create Date: 2026-08-26 17:20:00.000000
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0015"
down_revision: str | Sequence[str] | None = "0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("DELETE FROM tags WHERE tag_type = 'community'")


def downgrade() -> None:
    pass
