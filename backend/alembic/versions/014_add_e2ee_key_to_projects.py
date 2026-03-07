"""add e2ee_key to projects

Revision ID: c2332d99d8d6
Revises: 013_add_project_is_public
Create Date: 2026-03-06 02:26:04.357930

"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c2332d99d8d6"
down_revision: str | Sequence[str] | None = "013_add_project_is_public"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("e2ee_key", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("projects", "e2ee_key")
