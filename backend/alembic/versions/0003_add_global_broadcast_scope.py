"""add global broadcast scope

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-31
"""

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("broadcasts", sa.Column("is_global", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.alter_column("broadcasts", "radius_meters", existing_type=sa.Integer(), nullable=True)


def downgrade() -> None:
    op.execute("UPDATE broadcasts SET radius_meters = 50000 WHERE radius_meters IS NULL")
    op.alter_column("broadcasts", "radius_meters", existing_type=sa.Integer(), nullable=False)
    op.drop_column("broadcasts", "is_global")
