"""Add username, profile fields, channels, and user groups.

Revision ID: 012_username_profile_channels
Revises: 011_add_chat_messages
Create Date: 2026-03-02
"""

import sqlalchemy as sa

from alembic import op

revision = "012_username_profile_channels"
down_revision = "011_add_chat_messages"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── User profile fields ──────────────────────────────────────────────
    op.add_column("users", sa.Column("username", sa.String(), nullable=True))
    op.add_column("users", sa.Column("banner_url", sa.String(), nullable=True))
    op.add_column("users", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("phone", sa.String(), nullable=True))
    op.add_column("users", sa.Column("timezone", sa.String(), nullable=True))
    op.add_column(
        "users",
        sa.Column(
            "show_projects", sa.Boolean(), nullable=False, server_default="true"
        ),
    )
    op.add_column("users", sa.Column("link_x", sa.String(), nullable=True))
    op.add_column("users", sa.Column("link_discord", sa.String(), nullable=True))
    op.add_column("users", sa.Column("link_bsky", sa.String(), nullable=True))
    op.add_column("users", sa.Column("link_linkedin", sa.String(), nullable=True))
    op.add_column("users", sa.Column("link_website", sa.String(), nullable=True))
    op.create_index("ix_users_username", "users", ["username"], unique=True)

    # ── Channels ─────────────────────────────────────────────────────────
    op.create_table(
        "channels",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "project_id",
            sa.String(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "is_default", sa.Boolean(), nullable=False, server_default="false"
        ),
        sa.Column(
            "created_by",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint(
            "project_id", "name", name="uq_channel_name_per_project"
        ),
    )
    op.create_index("ix_channels_project_id", "channels", ["project_id"])

    # ── Channel members ──────────────────────────────────────────────────
    op.create_table(
        "channel_members",
        sa.Column(
            "channel_id",
            sa.String(),
            sa.ForeignKey("channels.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "user_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("added_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── User groups ──────────────────────────────────────────────────────
    op.create_table(
        "user_groups",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "project_id",
            sa.String(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column(
            "created_by",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint(
            "project_id", "name", name="uq_user_group_name_per_project"
        ),
    )
    op.create_index("ix_user_groups_project_id", "user_groups", ["project_id"])

    # ── User group members ───────────────────────────────────────────────
    op.create_table(
        "user_group_members",
        sa.Column(
            "group_id",
            sa.String(),
            sa.ForeignKey("user_groups.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "user_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("added_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # ── ChatMessage: add channel_id and mentions columns ─────────────────
    op.add_column(
        "chat_messages", sa.Column("channel_id", sa.String(), nullable=True)
    )
    op.add_column("chat_messages", sa.Column("mentions", sa.JSON(), nullable=True))
    op.create_foreign_key(
        "fk_chat_messages_channel_id",
        "chat_messages",
        "channels",
        ["channel_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(
        "ix_chat_messages_channel_created",
        "chat_messages",
        ["channel_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_chat_messages_channel_created", table_name="chat_messages")
    op.drop_constraint(
        "fk_chat_messages_channel_id", "chat_messages", type_="foreignkey"
    )
    op.drop_column("chat_messages", "mentions")
    op.drop_column("chat_messages", "channel_id")
    op.drop_table("user_group_members")
    op.drop_table("user_groups")
    op.drop_table("channel_members")
    op.drop_table("channels")
    op.drop_index("ix_users_username", table_name="users")
    op.drop_column("users", "link_website")
    op.drop_column("users", "link_linkedin")
    op.drop_column("users", "link_bsky")
    op.drop_column("users", "link_discord")
    op.drop_column("users", "link_x")
    op.drop_column("users", "show_projects")
    op.drop_column("users", "timezone")
    op.drop_column("users", "phone")
    op.drop_column("users", "description")
    op.drop_column("users", "banner_url")
    op.drop_column("users", "username")
