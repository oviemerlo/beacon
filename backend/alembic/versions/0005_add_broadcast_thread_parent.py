"""add broadcast thread parent link

Revision ID: 0005
Revises: 0004
Create Date: 2026-08-19
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("broadcasts", sa.Column("parent_broadcast_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_broadcasts_parent_broadcast_id",
        "broadcasts",
        "broadcasts",
        ["parent_broadcast_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_broadcasts_parent_broadcast_id", "broadcasts", ["parent_broadcast_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_broadcasts_parent_broadcast_id", table_name="broadcasts")
    op.drop_constraint("fk_broadcasts_parent_broadcast_id", "broadcasts", type_="foreignkey")
    op.drop_column("broadcasts", "parent_broadcast_id")
