"""Add password hash field to users for local auth mode

Revision ID: b7c2d9f13a44
Revises: a3f7c2e5b9d1
Create Date: 2026-04-23 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "b7c2d9f13a44"
down_revision: str | Sequence[str] | None = "a3f7c2e5b9d1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("users", sa.Column("password_hash", sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("users", "password_hash")
