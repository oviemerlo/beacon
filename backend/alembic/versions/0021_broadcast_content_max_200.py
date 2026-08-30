"""cap broadcast content at 200 characters

Revision ID: 0021
Revises: 0020
Create Date: 2026-08-29
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0021"
down_revision: str | Sequence[str] | None = "0020"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(sa.text("UPDATE broadcasts SET content = left(content, 200) WHERE char_length(content) > 200"))
    op.execute("DROP INDEX IF EXISTS ix_broadcasts_search_vector")
    op.execute("ALTER TABLE broadcasts DROP COLUMN search_vector")
    op.alter_column("broadcasts", "content", existing_type=sa.String(2000), type_=sa.String(200), existing_nullable=False)
    op.execute(
        """
        ALTER TABLE broadcasts
        ADD COLUMN search_vector tsvector
        GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED
        """
    )
    op.execute("CREATE INDEX ix_broadcasts_search_vector ON broadcasts USING GIN (search_vector)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_broadcasts_search_vector")
    op.execute("ALTER TABLE broadcasts DROP COLUMN search_vector")
    op.alter_column("broadcasts", "content", existing_type=sa.String(200), type_=sa.String(2000), existing_nullable=False)
    op.execute(
        """
        ALTER TABLE broadcasts
        ADD COLUMN search_vector tsvector
        GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED
        """
    )
    op.execute("CREATE INDEX ix_broadcasts_search_vector ON broadcasts USING GIN (search_vector)")
