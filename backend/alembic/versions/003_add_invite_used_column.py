"""Add used column to project_invites table

Revision ID: 003_add_invite_used
Revises: 002_versioning_privacy
Create Date: 2026-01-18

This migration adds the missing 'used' column to the project_invites table.
The column was present in the model but missing from the baseline migration.


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

# revision identifiers, used by Alembic.
revision = "003_add_invite_used"
down_revision = "002_versioning_privacy"
branch_labels = None
depends_on = None


def upgrade():
    # Add the 'used' column to project_invites table
    # This column tracks whether a single-use invite has been redeemed
    op.add_column(
        "project_invites",
        sa.Column("used", sa.Boolean(), nullable=False, server_default="false"),
    )

    # Add 'max_uses' column for multi-use invites (None = unlimited)
    op.add_column(
        "project_invites", sa.Column("max_uses", sa.Integer(), nullable=True)
    )

    # Add 'use_count' column to track how many times an invite has been used
    op.add_column(
        "project_invites",
        sa.Column("use_count", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade():
    op.drop_column("project_invites", "use_count")
    op.drop_column("project_invites", "max_uses")
    op.drop_column("project_invites", "used")
