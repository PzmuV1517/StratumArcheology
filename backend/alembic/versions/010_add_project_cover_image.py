"""Add cover_image_url to projects

Revision ID: 010_add_project_cover_image
Revises: 009_add_wheeler_render_columns
Create Date: 2026-03-01


STRATUM - Proprietary and Confidential
Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
All rights reserved.
No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
"""

import sqlalchemy as sa

from alembic import op

revision = "010_add_project_cover_image"
down_revision = "009_add_wheeler_render_columns"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("cover_image_url", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("projects", "cover_image_url")
