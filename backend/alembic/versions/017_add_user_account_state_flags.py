"""Add user account state flags for dashboard management

Revision ID: 9e32a5c7d4f1
Revises: f5e0c2199d1a
Create Date: 2026-04-05 16:15:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9e32a5c7d4f1"
down_revision: str | Sequence[str] | None = "f5e0c2199d1a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "users",
        sa.Column(
            "is_account_disabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "is_soft_deleted",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "users", sa.Column("soft_deleted_at", sa.DateTime(), nullable=True)
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("users", "soft_deleted_at")
    op.drop_column("users", "is_soft_deleted")
    op.drop_column("users", "is_account_disabled")
