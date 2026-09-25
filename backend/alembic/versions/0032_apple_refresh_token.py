"""add encrypted Apple refresh token on oauth_accounts

Revision ID: 0032
Revises: 0031
Create Date: 2026-09-24
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0032"
down_revision: str | Sequence[str] | None = "0031"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("oauth_accounts", sa.Column("apple_refresh_token_enc", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("oauth_accounts", "apple_refresh_token_enc")
