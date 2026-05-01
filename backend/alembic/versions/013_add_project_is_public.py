"""Add is_public column to projects

Revision ID: 013_add_project_is_public
Revises: 012_username_profile_channels
Create Date: 2026-01-15

This migration adds the is_public boolean column to the projects table,
allowing project owners to make their projects publicly discoverable.

STRATUM - Proprietary and Confidential
Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
All rights reserved.
No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "013_add_project_is_public"
down_revision = "012_username_profile_channels"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "projects",
        sa.Column(
            "is_public",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade():
    op.drop_column("projects", "is_public")
