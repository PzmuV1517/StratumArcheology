"""Add has_completed_onboarding column to users table

Revision ID: 006_add_user_onboarding
Revises: 005_add_user_bio
Create Date: 2026-02-15



STRATUM - Proprietary and Confidential
Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
All rights reserved.
No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "006_add_user_onboarding"
down_revision = "005_add_user_bio"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add has_completed_onboarding column to users table
    op.add_column(
        "users",
        sa.Column(
            "has_completed_onboarding",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "has_completed_onboarding")
