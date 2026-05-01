"""Add bio column to users table

Revision ID: 005_add_user_bio
Revises: 004_harris_matrix_data
Create Date: 2026-02-01



STRATUM - Proprietary and Confidential
Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
All rights reserved.
No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "005_add_user_bio"
down_revision = "004_harris_matrix_data"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add bio column to users table
    op.add_column(
        "users",
        sa.Column("bio", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "bio")
