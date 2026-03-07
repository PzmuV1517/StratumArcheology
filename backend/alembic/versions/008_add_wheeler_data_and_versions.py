"""Add wheeler_data column and data_versions table for Time Machine

Revision ID: 008_add_wheeler_data_and_versions
Revises: 007_add_qr_codes
Create Date: 2026-02-20


MIT License

Copyright (c) 2025 Banu Andrei & Mircea Levin-Constantin

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
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
