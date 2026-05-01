"""Add wheeler_data column and data_versions table for Time Machine

Revision ID: 008_add_wheeler_data_and_versions
Revises: 007_add_qr_codes
Create Date: 2026-02-20


STRATUM - Proprietary and Confidential
Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
All rights reserved.
No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

from alembic import op

# revision identifiers
revision = "008_add_wheeler_and_versions"
down_revision = "007_add_qr_codes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add wheeler_data column to projects table
    op.add_column(
        "projects",
        sa.Column("wheeler_data", JSON, nullable=True),
    )
    # Add version counters for Time Machine support
    op.add_column(
        "projects",
        sa.Column(
            "harris_matrix_version",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "projects",
        sa.Column(
            "wheeler_data_version",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )

    # Create data_versions table for Harris Matrix / Wheeler version history
    op.create_table(
        "data_versions",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "project_id",
            sa.String(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("data_type", sa.String(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("data", JSON, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "created_by",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.UniqueConstraint(
            "project_id", "data_type", "version", name="uq_data_version"
        ),
        sa.Index("ix_data_versions_project_type", "project_id", "data_type"),
    )


def downgrade() -> None:
    op.drop_table("data_versions")
    op.drop_column("projects", "wheeler_data_version")
    op.drop_column("projects", "harris_matrix_version")
    op.drop_column("projects", "wheeler_data")
