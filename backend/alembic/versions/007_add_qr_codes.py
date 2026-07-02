"""add qr_codes table

Revision ID: 007_add_qr_codes
Revises: 006_add_user_onboarding
Create Date: 2026-02-15


STRATUM - Proprietary and Confidential
Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
All rights reserved.
No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers
revision = "007_add_qr_codes"
down_revision = "006_add_user_onboarding"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "qr_codes",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("code", sa.String(), nullable=False, unique=True, index=True),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("resource_id", sa.String(), nullable=False),
        sa.Column(
            "project_id",
            sa.String(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=True,
            index=True,
        ),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column(
            "created_by",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
        ),
    )


def downgrade() -> None:
    op.drop_table("qr_codes")
