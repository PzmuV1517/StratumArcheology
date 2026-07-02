"""Add project_ai_summaries table for persistent per-user AI summaries

Revision ID: c4e1f8a2b0d3
Revises: b7c2d9f13a44
Create Date: 2026-04-28 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "c4e1f8a2b0d3"
down_revision: str | Sequence[str] | None = "b7c2d9f13a44"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "project_ai_summaries",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("provider", sa.String(), nullable=False),
        sa.Column("generated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("project_id", "user_id", name="uq_project_user_ai_summary"),
    )
    op.create_index("ix_project_ai_summaries_project_id", "project_ai_summaries", ["project_id"])


def downgrade() -> None:
    op.drop_index("ix_project_ai_summaries_project_id", table_name="project_ai_summaries")
    op.drop_table("project_ai_summaries")
