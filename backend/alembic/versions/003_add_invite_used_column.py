"""Add used column to project_invites table

Revision ID: 003_add_invite_used
Revises: 002_versioning_privacy
Create Date: 2026-01-18

This migration adds the missing 'used' column to the project_invites table.
The column was present in the model but missing from the baseline migration.
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
    op.add_column("project_invites", sa.Column("used", sa.Boolean(), nullable=False, server_default="false"))

    # Add 'max_uses' column for multi-use invites (None = unlimited)
    op.add_column("project_invites", sa.Column("max_uses", sa.Integer(), nullable=True))

    # Add 'use_count' column to track how many times an invite has been used
    op.add_column("project_invites", sa.Column("use_count", sa.Integer(), nullable=False, server_default="0"))


def downgrade():
    op.drop_column("project_invites", "use_count")
    op.drop_column("project_invites", "max_uses")
    op.drop_column("project_invites", "used")
