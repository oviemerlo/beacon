"""add broadcast school and course scope

Revision ID: 0008
Revises: 0007
Create Date: 2026-08-19
"""

import sqlalchemy as sa
from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("broadcasts", sa.Column("school_id", sa.Integer(), nullable=True))
    op.add_column("broadcasts", sa.Column("course_code", sa.String(length=30), nullable=True))
    op.create_foreign_key(
        "fk_broadcasts_school_id",
        "broadcasts",
        "schools",
        ["school_id"],
        ["id"],
    )
    op.create_index("ix_broadcasts_school_id", "broadcasts", ["school_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_broadcasts_school_id", table_name="broadcasts")
    op.drop_constraint("fk_broadcasts_school_id", "broadcasts", type_="foreignkey")
    op.drop_column("broadcasts", "course_code")
    op.drop_column("broadcasts", "school_id")
