"""Add wheeler_render_path and wheeler_render_version to projects

Revision ID: 009_add_wheeler_render_columns
Revises: 008_add_wheeler_and_versions
Create Date: 2026-02-26


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
