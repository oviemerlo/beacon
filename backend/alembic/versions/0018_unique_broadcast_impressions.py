"""unique broadcast impressions per viewer

Revision ID: 0018
Revises: 0017
Create Date: 2026-08-27
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0018"
down_revision: str | Sequence[str] | None = "0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        DELETE FROM broadcast_impressions
        WHERE id NOT IN (
            SELECT DISTINCT ON (broadcast_id, viewer_id) id
            FROM broadcast_impressions
            ORDER BY broadcast_id, viewer_id, shown_at ASC, id ASC
        )
        """
    )
    op.drop_index("ix_impressions_broadcast_viewer", table_name="broadcast_impressions")
    op.create_unique_constraint(
        "uq_broadcast_impressions_broadcast_viewer",
        "broadcast_impressions",
        ["broadcast_id", "viewer_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_broadcast_impressions_broadcast_viewer", "broadcast_impressions", type_="unique")
    op.create_index("ix_impressions_broadcast_viewer", "broadcast_impressions", ["broadcast_id", "viewer_id"])
