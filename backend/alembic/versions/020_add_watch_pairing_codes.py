"""Add watch_pairing_codes table

Revision ID: c8b1f4d2a7e9
Revises: a3f7c2e5b9d1
Create Date: 2026-04-27 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "c8b1f4d2a7e9"
down_revision: str | Sequence[str] | None = "a3f7c2e5b9d1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "watch_pairing_codes",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("code", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("used_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_index(
        "ix_watch_pairing_codes_code", "watch_pairing_codes", ["code"], unique=True
    )
    op.create_index(
        "ix_watch_pairing_codes_user_id",
        "watch_pairing_codes",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_watch_pairing_codes_user_id", table_name="watch_pairing_codes")
    op.drop_index("ix_watch_pairing_codes_code", table_name="watch_pairing_codes")
    op.drop_table("watch_pairing_codes")
