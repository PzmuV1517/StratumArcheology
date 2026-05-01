"""Add chat_messages table

Revision ID: 011_add_chat_messages
Revises: 010_add_project_cover_image
Create Date: 2026-03-01


STRATUM - Proprietary and Confidential
Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
All rights reserved.
No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
"""

import sqlalchemy as sa

from alembic import op

revision = "011_add_chat_messages"
down_revision = "010_add_project_cover_image"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "chat_messages",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "sender_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "project_id",
            sa.String(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "recipient_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "reply_to_id",
            sa.String(),
            sa.ForeignKey("chat_messages.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("edited_at", sa.DateTime(), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default="false"),
    )

    # Indexes
    op.create_index("ix_chat_messages_sender_id", "chat_messages", ["sender_id"])
    op.create_index("ix_chat_messages_project_id", "chat_messages", ["project_id"])
    op.create_index(
        "ix_chat_messages_recipient_id", "chat_messages", ["recipient_id"]
    )
    op.create_index("ix_chat_messages_created_at", "chat_messages", ["created_at"])
    op.create_index(
        "ix_chat_messages_project_created",
        "chat_messages",
        ["project_id", "created_at"],
    )
    op.create_index(
        "ix_chat_messages_dm",
        "chat_messages",
        ["sender_id", "recipient_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_chat_messages_dm", "chat_messages")
    op.drop_index("ix_chat_messages_project_created", "chat_messages")
    op.drop_index("ix_chat_messages_created_at", "chat_messages")
    op.drop_index("ix_chat_messages_recipient_id", "chat_messages")
    op.drop_index("ix_chat_messages_project_id", "chat_messages")
    op.drop_index("ix_chat_messages_sender_id", "chat_messages")
    op.drop_table("chat_messages")
