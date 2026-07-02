"""
Initial baseline migration for STRATUM database

This migration creates all tables as they currently exist in the codebase.
It establishes the baseline schema from which all future migrations will be applied.

Revision ID: 001_baseline
Revises: None
Create Date: 2025-12-16

Tables created:
- users: User accounts linked to Firebase
- projects: Archaeological projects
- project_members: Many-to-many user-project relationship
- notes: Rich text notes attached to projects
- note_attachments: Files attached to notes
- file_nodes: Hierarchical file system for projects
- note_file_links: Links notes to their file system representation
- project_gps: GPS data (work areas, site polygons) per project
- project_invites: Invitation tokens for joining projects
- project_activities: Activity log for projects


STRATUM - Proprietary and Confidential
Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
All rights reserved.
No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
"""

import sqlalchemy as sa

from alembic import op

# Revision identifiers
revision = "001_baseline"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Create all tables for STRATUM v1.0.

    This baseline migration assumes a fresh database.
    If tables already exist (from previous create_all usage),
    this migration will be marked as applied without changes.
    """

    # Create users table
    op.create_table(
        "users",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("firebase_uid", sa.String(), nullable=False, unique=True),
        sa.Column("email", sa.String(), nullable=False, unique=True),
        sa.Column("display_name", sa.String(), nullable=True),
        sa.Column("photo_url", sa.String(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(), nullable=True, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(), nullable=True, server_default=sa.func.now()
        ),
        sa.Column("last_login", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_users_firebase_uid", "users", ["firebase_uid"])
    op.create_index("ix_users_email", "users", ["email"])

    # Create projects table
    op.create_table(
        "projects",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("ran_lmi_id", sa.String(), nullable=True),
        sa.Column(
            "owner_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at", sa.DateTime(), nullable=True, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(), nullable=True, server_default=sa.func.now()
        ),
        sa.Column("is_active", sa.Boolean(), default=True),
    )

    # Create project_members association table
    op.create_table(
        "project_members",
        sa.Column(
            "project_id",
            sa.String(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
        ),
        sa.Column(
            "user_id", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE")
        ),
        sa.Column("role", sa.String(), default="guest"),
        sa.Column("joined_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # Create notes table
    op.create_table(
        "notes",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column(
            "project_id",
            sa.String(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "author_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at", sa.DateTime(), nullable=True, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(), nullable=True, server_default=sa.func.now()
        ),
        sa.Column("last_synced", sa.DateTime(), nullable=True),
    )

    # Create note_attachments table
    op.create_table(
        "note_attachments",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "note_id",
            sa.String(),
            sa.ForeignKey("notes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("filename", sa.String(), nullable=False),
        sa.Column("file_path", sa.String(), nullable=False),
        sa.Column("file_type", sa.String(), nullable=False),
        sa.Column("file_size", sa.String(), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # Create file_nodes table (hierarchical file system)
    op.create_table(
        "file_nodes",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "project_id",
            sa.String(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "parent_id",
            sa.String(),
            sa.ForeignKey("file_nodes.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("type", sa.String(), nullable=False, server_default="file"),
        sa.Column("mime_type", sa.String(), nullable=True),
        sa.Column("size", sa.String(), nullable=True),
        sa.Column("storage_path", sa.String(), nullable=True),
        sa.Column("is_locked", sa.Boolean(), default=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_file_nodes_project_id", "file_nodes", ["project_id"])
    op.create_index("ix_file_nodes_parent_id", "file_nodes", ["parent_id"])
    op.create_index(
        "ix_file_nodes_project_parent", "file_nodes", ["project_id", "parent_id"]
    )
    op.create_unique_constraint(
        "uq_file_nodes_sibling_name",
        "file_nodes",
        ["project_id", "parent_id", "name"],
    )

    # Create note_file_links table
    op.create_table(
        "note_file_links",
        sa.Column(
            "note_id",
            sa.String(),
            sa.ForeignKey("notes.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "file_node_id",
            sa.String(),
            sa.ForeignKey("file_nodes.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
    )

    # Create project_gps table
    op.create_table(
        "project_gps",
        sa.Column(
            "project_id",
            sa.String(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("data", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # Create project_invites table
    op.create_table(
        "project_invites",
        sa.Column("token", sa.String(), primary_key=True),
        sa.Column("code", sa.String(), unique=True, nullable=True),
        sa.Column(
            "project_id",
            sa.String(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(), nullable=False, server_default="guest"),
        sa.Column(
            "created_by",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column(
            "redeemed_by",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("redeemed_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_project_invites_code", "project_invites", ["code"])
    op.create_index(
        "ix_project_invites_project_id", "project_invites", ["project_id"]
    )

    # Create project_activities table
    op.create_table(
        "project_activities",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "project_id",
            sa.String(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("activity_type", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("extra_data", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index(
        "ix_project_activities_project_created",
        "project_activities",
        ["project_id", "created_at"],
    )


def downgrade() -> None:
    """
    Drop all tables.

    WARNING: This will destroy all data!
    Only use in development or for complete schema reset.
    """
    # Drop in reverse order of dependencies
    op.drop_table("project_activities")
    op.drop_table("project_invites")
    op.drop_table("project_gps")
    op.drop_table("note_file_links")
    op.drop_table("file_nodes")
    op.drop_table("note_attachments")
    op.drop_table("notes")
    op.drop_table("project_members")
    op.drop_table("projects")
    op.drop_table("users")
