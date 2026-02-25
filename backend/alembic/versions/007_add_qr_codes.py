"""add qr_codes table

Revision ID: 007_add_qr_codes
Revises: 006_add_user_onboarding
Create Date: 2026-02-15
"""

from alembic import op
import sqlalchemy as sa

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
