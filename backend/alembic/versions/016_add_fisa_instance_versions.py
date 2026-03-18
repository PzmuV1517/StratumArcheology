"""Add fisa_instance_versions table

Revision ID: f5e0c2199d1a
Revises: 4bbfeda351c1
Create Date: 2026-03-18 21:10:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "f5e0c2199d1a"
down_revision: Union[str, Sequence[str], None] = "4bbfeda351c1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


FISA_INSTANCE_STATUS_ENUM = postgresql.ENUM(
    "DRAFT",
    "COMPLETAT",
    "FINALIZAT",
    "IN_VERIFICARE",
    "IN_APROBARE",
    "VALIDAT",
    "REINTORS",
    name="fisainstancestatus",
    create_type=False,
)


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "fisa_instance_versions",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("fisa_instance_id", sa.String(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("status", FISA_INSTANCE_STATUS_ENUM, nullable=False),
        sa.Column("data", sa.JSON(), nullable=False),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("changed_by", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["changed_by"], ["users.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["fisa_instance_id"], ["fisa_instances.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "fisa_instance_id", "version", name="uq_fisa_instance_version"
        ),
    )
    op.create_index(
        op.f("ix_fisa_instance_versions_fisa_instance_id"),
        "fisa_instance_versions",
        ["fisa_instance_id"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(
        op.f("ix_fisa_instance_versions_fisa_instance_id"),
        table_name="fisa_instance_versions",
    )
    op.drop_table("fisa_instance_versions")
