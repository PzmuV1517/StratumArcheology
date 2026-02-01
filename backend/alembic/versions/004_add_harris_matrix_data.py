"""Add harris_matrix_data column to projects

Revision ID: 004_harris_matrix_data
Revises: 003_add_invite_used
Create Date: 2026-02-01

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

# revision identifiers, used by Alembic.
revision = "004_harris_matrix_data"
down_revision = "003_add_invite_used"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add harris_matrix_data column to projects table
    op.add_column(
        "projects",
        sa.Column("harris_matrix_data", JSON, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("projects", "harris_matrix_data")
