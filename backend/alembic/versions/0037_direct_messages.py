"""direct messages: dm permission, gate tags, pending request status

Revision ID: 0037
Revises: 0036
Create Date: 2026-10-17
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0037"
down_revision = "0036"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_dm_tags",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("tag_id", sa.Integer(), sa.ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.add_column(
        "users",
        sa.Column("dm_permission", sa.String(length=20), nullable=False, server_default="no_one"),
    )
    op.create_check_constraint(
        "ck_users_dm_permission",
        "users",
        "dm_permission IN ('everyone', 'tag_match', 'no_one')",
    )
    op.add_column("conversations", sa.Column("dm_status", sa.String(length=20), nullable=True))
    op.create_check_constraint(
        "ck_conversations_dm_status",
        "conversations",
        "dm_status IS NULL OR dm_status IN ('pending', 'accepted', 'declined')",
    )
    op.execute(
        """
        CREATE UNIQUE INDEX uq_direct_conversation_pair
        ON conversations (LEAST(initiator_id, recipient_id), GREATEST(initiator_id, recipient_id))
        WHERE origin_broadcast_id IS NULL AND name IS NULL
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_direct_conversation_pair")
    op.drop_constraint("ck_conversations_dm_status", "conversations", type_="check")
    op.drop_column("conversations", "dm_status")
    op.drop_constraint("ck_users_dm_permission", "users", type_="check")
    op.drop_column("users", "dm_permission")
    op.drop_table("user_dm_tags")
