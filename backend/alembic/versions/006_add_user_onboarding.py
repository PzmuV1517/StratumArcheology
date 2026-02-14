"""Add has_completed_onboarding column to users table

Revision ID: 006_add_user_onboarding
Revises: 005_add_user_bio
Create Date: 2026-02-15

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "006_add_user_onboarding"
down_revision = "005_add_user_bio"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add has_completed_onboarding column to users table
    op.add_column(
        "users",
        sa.Column("has_completed_onboarding", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("users", "has_completed_onboarding")
