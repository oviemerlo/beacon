"""keep reports when a user is deleted

Revision ID: 0034
Revises: 0033
Create Date: 2026-09-24
"""

from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0034"
down_revision = "0033"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("reports_reporter_id_fkey", "reports", type_="foreignkey")
    op.alter_column("reports", "reporter_id", existing_type=postgresql.UUID(as_uuid=True), nullable=True)
    op.create_foreign_key(
        "reports_reporter_id_fkey",
        "reports",
        "users",
        ["reporter_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.execute("DELETE FROM reports WHERE reporter_id IS NULL")
    op.drop_constraint("reports_reporter_id_fkey", "reports", type_="foreignkey")
    op.alter_column("reports", "reporter_id", existing_type=postgresql.UUID(as_uuid=True), nullable=False)
    op.create_foreign_key(
        "reports_reporter_id_fkey",
        "reports",
        "users",
        ["reporter_id"],
        ["id"],
        ondelete="CASCADE",
    )
