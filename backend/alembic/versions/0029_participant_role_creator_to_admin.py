"""rename conversation participant role creator -> admin

Revision ID: 0029
Revises: 0028
Create Date: 2026-09-07
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0029"
down_revision: str | Sequence[str] | None = "0028"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("UPDATE conversation_participants SET role = 'admin' WHERE role = 'creator'")


def downgrade() -> None:
    op.execute("UPDATE conversation_participants SET role = 'creator' WHERE role = 'admin'")
