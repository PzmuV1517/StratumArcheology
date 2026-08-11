"""Add public history review fields to projects

Revision ID: d3e5a9f1c2b7
Revises: c4e1f8a2b0d3
Create Date: 2026-04-29 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "d3e5a9f1c2b7"
down_revision: str | Sequence[str] | None = "c4e1f8a2b0d3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "projects", sa.Column("public_history_review", sa.Text(), nullable=True)
    )
    op.add_column(
        "projects", sa.Column("public_history_provider", sa.String(), nullable=True)
    )
    op.add_column(
        "projects",
        sa.Column("public_history_generated_at", sa.DateTime(), nullable=True),
    )
    op.add_column(
        "projects",
        sa.Column(
            "history_needs_refresh",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )


def downgrade() -> None:
    op.drop_column("projects", "history_needs_refresh")
    op.drop_column("projects", "public_history_generated_at")
    op.drop_column("projects", "public_history_provider")
    op.drop_column("projects", "public_history_review")
