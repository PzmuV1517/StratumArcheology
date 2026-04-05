"""Add auth provider metadata to users

Revision ID: 2f4c9e7b1a6d
Revises: 9e32a5c7d4f1
Create Date: 2026-04-05 20:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2f4c9e7b1a6d"
down_revision: str | Sequence[str] | None = "9e32a5c7d4f1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("users", sa.Column("auth_provider", sa.String(), nullable=True))
    op.create_index(
        op.f("ix_users_auth_provider"),
        "users",
        ["auth_provider"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_users_auth_provider"), table_name="users")
    op.drop_column("users", "auth_provider")
