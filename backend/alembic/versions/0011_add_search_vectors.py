"""generated search_vector columns + GIN indexes for feed history search

Revision ID: 0011
Revises: 0010
Create Date: 2026-08-22 14:23:00.000000
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0011"
down_revision: str | Sequence[str] | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE broadcasts
        ADD COLUMN search_vector tsvector
        GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED
        """
    )
    op.execute("CREATE INDEX ix_broadcasts_search_vector ON broadcasts USING GIN (search_vector)")
    op.execute(
        """
        ALTER TABLE messages
        ADD COLUMN search_vector tsvector
        GENERATED ALWAYS AS (to_tsvector('english', coalesce(body, ''))) STORED
        """
    )
    op.execute("CREATE INDEX ix_messages_search_vector ON messages USING GIN (search_vector)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_messages_search_vector")
    op.execute("ALTER TABLE messages DROP COLUMN IF EXISTS search_vector")
    op.execute("DROP INDEX IF EXISTS ix_broadcasts_search_vector")
    op.execute("ALTER TABLE broadcasts DROP COLUMN IF EXISTS search_vector")
