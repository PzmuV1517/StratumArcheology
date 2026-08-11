"""Add transcription fields to notes

Revision ID: a3f7c2e5b9d1
Revises: 2f4c9e7b1a6d
Create Date: 2026-04-19 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "a3f7c2e5b9d1"
down_revision: str | Sequence[str] | None = "2f4c9e7b1a6d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("notes", sa.Column("transcription", sa.Text(), nullable=True))
    op.add_column(
        "notes", sa.Column("transcription_original", sa.Text(), nullable=True)
    )
    op.add_column(
        "notes",
        sa.Column(
            "transcription_modified",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )
    op.add_column(
        "notes", sa.Column("transcription_status", sa.String(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("notes", "transcription_status")
    op.drop_column("notes", "transcription_modified")
    op.drop_column("notes", "transcription_original")
    op.drop_column("notes", "transcription")
