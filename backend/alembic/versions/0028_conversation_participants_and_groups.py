"""add conversation participants, invites, and group columns

Revision ID: 0028
Revises: 0027
Create Date: 2026-09-07
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0028"
down_revision: str | Sequence[str] | None = "0027"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("conversations", sa.Column("name", sa.String(200), nullable=True))
    op.add_column("conversations", sa.Column("max_participants", sa.Integer(), nullable=True))
    op.add_column(
        "conversations",
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.execute("UPDATE conversations SET created_by_user_id = initiator_id")
    op.alter_column("conversations", "created_by_user_id", nullable=False)
    op.create_foreign_key(
        "fk_conversations_created_by_user_id",
        "conversations",
        "users",
        ["created_by_user_id"],
        ["id"],
    )

    op.alter_column("conversations", "initiator_id", existing_type=postgresql.UUID(as_uuid=True), nullable=True)
    op.alter_column("conversations", "recipient_id", existing_type=postgresql.UUID(as_uuid=True), nullable=True)
    op.alter_column("conversations", "origin_broadcast_id", existing_type=postgresql.UUID(as_uuid=True), nullable=True)

    op.create_table(
        "conversation_participants",
        sa.Column(
            "conversation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("conversations.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("role", sa.String(20), nullable=False, server_default="member"),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.execute(
        """
        INSERT INTO conversation_participants (conversation_id, user_id, role)
        SELECT id, initiator_id, 'admin'
        FROM conversations
        WHERE initiator_id IS NOT NULL
        """
    )
    op.execute(
        """
        INSERT INTO conversation_participants (conversation_id, user_id, role)
        SELECT id, recipient_id, 'member'
        FROM conversations
        WHERE recipient_id IS NOT NULL
          AND recipient_id IS DISTINCT FROM initiator_id
        """
    )

    op.create_table(
        "conversation_invites",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "conversation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("conversations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token", sa.String(64), nullable=False),
        sa.Column("description", sa.String(280), nullable=True),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_conversation_invites_token", "conversation_invites", ["token"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_conversation_invites_token", table_name="conversation_invites")
    op.drop_table("conversation_invites")
    op.drop_table("conversation_participants")
    op.execute("DELETE FROM conversations WHERE initiator_id IS NULL OR recipient_id IS NULL OR origin_broadcast_id IS NULL")
    op.drop_constraint("fk_conversations_created_by_user_id", "conversations", type_="foreignkey")
    op.drop_column("conversations", "created_by_user_id")
    op.drop_column("conversations", "max_participants")
    op.drop_column("conversations", "name")
    op.alter_column("conversations", "initiator_id", existing_type=postgresql.UUID(as_uuid=True), nullable=False)
    op.alter_column("conversations", "recipient_id", existing_type=postgresql.UUID(as_uuid=True), nullable=False)
    op.alter_column("conversations", "origin_broadcast_id", existing_type=postgresql.UUID(as_uuid=True), nullable=False)
