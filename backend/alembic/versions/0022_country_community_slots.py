"""country community slots and change window

Revision ID: 0022
Revises: 0021
Create Date: 2026-08-29
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0022"
down_revision: str | Sequence[str] | None = "0021"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("country_slot_1_tag_id", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("country_slot_1_changed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("country_slot_2_tag_id", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("country_slot_2_changed_at", sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key(
        "fk_users_country_slot_1_tag_id",
        "users",
        "tags",
        ["country_slot_1_tag_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_users_country_slot_2_tag_id",
        "users",
        "tags",
        ["country_slot_2_tag_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.execute(
        """
        WITH ranked AS (
            SELECT
                uft.user_id,
                uft.tag_id,
                row_number() OVER (PARTITION BY uft.user_id ORDER BY uft.created_at, uft.tag_id) AS rn
            FROM user_followed_tags uft
            JOIN tags t ON t.id = uft.tag_id
            WHERE t.tag_type = 'nationality'
        )
        UPDATE users
        SET
            country_slot_1_tag_id = (
                SELECT ranked.tag_id FROM ranked WHERE ranked.user_id = users.id AND ranked.rn = 1
            ),
            country_slot_2_tag_id = (
                SELECT ranked.tag_id FROM ranked WHERE ranked.user_id = users.id AND ranked.rn = 2
            )
        """
    )


def downgrade() -> None:
    op.drop_constraint("fk_users_country_slot_2_tag_id", "users", type_="foreignkey")
    op.drop_constraint("fk_users_country_slot_1_tag_id", "users", type_="foreignkey")
    op.drop_column("users", "country_slot_2_changed_at")
    op.drop_column("users", "country_slot_2_tag_id")
    op.drop_column("users", "country_slot_1_changed_at")
    op.drop_column("users", "country_slot_1_tag_id")
