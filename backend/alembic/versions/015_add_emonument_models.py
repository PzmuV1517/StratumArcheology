"""Add eMonument models

Revision ID: 4bbfeda351c1
Revises: c2332d99d8d6
Create Date: 2026-03-18 20:53:22.699111

"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "4bbfeda351c1"
down_revision: str | Sequence[str] | None = "c2332d99d8d6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


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
    op.add_column(
        "users",
        sa.Column(
            "is_emonument_privileged",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "is_dashboard_admin",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )

    op.create_table(
        "monuments",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("lmi_code", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("county", sa.String(), nullable=True),
        sa.Column("locality", sa.String(), nullable=True),
        sa.Column("address", sa.String(), nullable=True),
        sa.Column("latitude", sa.String(), nullable=True),
        sa.Column("longitude", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_monuments_lmi_code"), "monuments", ["lmi_code"], unique=True
    )

    op.create_table(
        "device_whitelist",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("device_id", sa.String(), nullable=False),
        sa.Column("model_name", sa.String(), nullable=True),
        sa.Column("user_id", sa.String(), nullable=True),
        sa.Column("is_approved", sa.Boolean(), nullable=True),
        sa.Column("last_sync", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_device_whitelist_device_id"),
        "device_whitelist",
        ["device_id"],
        unique=True,
    )

    op.create_table(
        "monument_allocations",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("monument_id", sa.String(), nullable=False),
        sa.Column("allocated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["monument_id"], ["monuments.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id", "monument_id", name="uq_user_monument_allocation"
        ),
    )

    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_type WHERE typname = 'fisainstancestatus'
            ) THEN
                CREATE TYPE fisainstancestatus AS ENUM (
                    'DRAFT',
                    'COMPLETAT',
                    'FINALIZAT',
                    'IN_VERIFICARE',
                    'IN_APROBARE',
                    'VALIDAT',
                    'REINTORS'
                );
            END IF;
        END $$;
        """
    )

    op.create_table(
        "fisa_instances",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("monument_id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=True),
        sa.Column("device_id", sa.String(), nullable=True),
        sa.Column("status", FISA_INSTANCE_STATUS_ENUM, nullable=False),
        sa.Column("data", sa.JSON(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["device_id"], ["device_whitelist.device_id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["monument_id"], ["monuments.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("fisa_instances")
    op.drop_table("monument_allocations")
    op.drop_index(
        op.f("ix_device_whitelist_device_id"), table_name="device_whitelist"
    )
    op.drop_table("device_whitelist")
    op.drop_index(op.f("ix_monuments_lmi_code"), table_name="monuments")
    op.drop_table("monuments")

    op.execute("DROP TYPE IF EXISTS fisainstancestatus")

    op.drop_column("users", "is_dashboard_admin")
    op.drop_column("users", "is_emonument_privileged")
