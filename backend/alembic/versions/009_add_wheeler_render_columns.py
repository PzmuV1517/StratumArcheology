"""Add wheeler_render_path and wheeler_render_version to projects

Revision ID: 009_add_wheeler_render_columns
Revises: 008_add_wheeler_and_versions
Create Date: 2026-02-26


STRATUM - Proprietary and Confidential
Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
All rights reserved.
No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
"""

import sqlalchemy as sa

from alembic import op

revision = "009_add_wheeler_render_columns"
down_revision = "008_add_wheeler_and_versions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("wheeler_render_path", sa.Text(), nullable=True),
    )
    op.add_column(
        "projects",
        sa.Column("wheeler_render_version", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("projects", "wheeler_render_version")
    op.drop_column("projects", "wheeler_render_path")
