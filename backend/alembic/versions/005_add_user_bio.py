"""Add bio column to users table

Revision ID: 005_add_user_bio
Revises: 004_harris_matrix_data
Create Date: 2026-02-01

"""

from alembic import op
import sqlalchemy as sa

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
