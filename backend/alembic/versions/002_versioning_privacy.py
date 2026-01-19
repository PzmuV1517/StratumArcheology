"""Add versioning and privacy to files and notes

Revision ID: 002_versioning_privacy
Revises: 001_baseline
Create Date: 2026-01-11

This migration adds:
- version, checksum, owner_id, privacy, shared_with fields to file_nodes
- version, privacy, shared_with fields to notes
- file_versions table for version history
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "002_versioning_privacy"
down_revision = "001_baseline"
branch_labels = None
depends_on = None


def upgrade():
    # Create PrivacyLevel enum type
    privacy_enum = sa.Enum("private", "shared", "project", "public", name="privacylevel")
    privacy_enum.create(op.get_bind(), checkfirst=True)

    # Add versioning and privacy columns to file_nodes
    op.add_column(
        "file_nodes", sa.Column("version", sa.Integer(), nullable=False, server_default="1")
    )
    op.add_column("file_nodes", sa.Column("checksum", sa.String(), nullable=True))
    op.add_column("file_nodes", sa.Column("owner_id", sa.String(), nullable=True))
    op.add_column(
        "file_nodes", sa.Column("privacy", privacy_enum, nullable=False, server_default="project")
    )
    op.add_column("file_nodes", sa.Column("shared_with", sa.JSON(), nullable=True))

    # Add foreign key for owner_id
    op.create_foreign_key(
        "fk_file_nodes_owner_id", "file_nodes", "users", ["owner_id"], ["id"], ondelete="SET NULL"
    )

    # Add index for owner_id
    op.create_index("ix_file_nodes_owner", "file_nodes", ["owner_id"])

    # Add versioning and privacy columns to notes
    op.add_column("notes", sa.Column("version", sa.Integer(), nullable=False, server_default="1"))
    op.add_column(
        "notes", sa.Column("privacy", privacy_enum, nullable=False, server_default="project")
    )
    op.add_column("notes", sa.Column("shared_with", sa.JSON(), nullable=True))

    # Create file_versions table
    op.create_table(
        "file_versions",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "file_node_id",
            sa.String(),
            sa.ForeignKey("file_nodes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("storage_path", sa.String(), nullable=False),
        sa.Column("size", sa.String(), nullable=True),
        sa.Column("checksum", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column(
            "created_by", sa.String(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
        ),
        sa.UniqueConstraint("file_node_id", "version", name="uq_file_version"),
    )
    op.create_index("ix_file_versions_file_node", "file_versions", ["file_node_id"])


def downgrade():
    # Drop file_versions table
    op.drop_index("ix_file_versions_file_node", "file_versions")
    op.drop_table("file_versions")

    # Remove columns from notes
    op.drop_column("notes", "shared_with")
    op.drop_column("notes", "privacy")
    op.drop_column("notes", "version")

    # Remove columns from file_nodes
    op.drop_index("ix_file_nodes_owner", "file_nodes")
    op.drop_constraint("fk_file_nodes_owner_id", "file_nodes", type_="foreignkey")
    op.drop_column("file_nodes", "shared_with")
    op.drop_column("file_nodes", "privacy")
    op.drop_column("file_nodes", "owner_id")
    op.drop_column("file_nodes", "checksum")
    op.drop_column("file_nodes", "version")

    # Drop PrivacyLevel enum
    sa.Enum(name="privacylevel").drop(op.get_bind(), checkfirst=True)
