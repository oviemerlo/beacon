"""replace continent tags with the 13-region taxonomy

Revision ID: 0014
Revises: 0013
Create Date: 2026-08-26 14:50:00.000000
"""

from collections.abc import Sequence

from alembic import op
from sqlalchemy import String, bindparam, text

from app.services.regions import ALL_REGIONS

revision: str = "0014"
down_revision: str | Sequence[str] | None = "0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(text("UPDATE tags SET tag_type = 'region' WHERE tag_type = 'continent'"))

    if ALL_REGIONS:
        conn.execute(
            text("DELETE FROM tags WHERE tag_type = 'region' AND label NOT IN :labels").bindparams(
                bindparam("labels", type_=String(100), expanding=True)
            ),
            {"labels": list(ALL_REGIONS)},
        )

    insert_missing = text(
        """
        INSERT INTO tags (tag_type, label)
        SELECT 'region', CAST(:label AS VARCHAR(100))
        WHERE NOT EXISTS (
            SELECT 1 FROM tags
            WHERE tag_type = 'region' AND label = CAST(:label AS VARCHAR(100))
        )
        """
    ).bindparams(bindparam("label", type_=String(100)))
    for label in ALL_REGIONS:
        conn.execute(insert_missing, {"label": label})


def downgrade() -> None:
    op.execute("UPDATE tags SET tag_type = 'continent' WHERE tag_type = 'region'")
