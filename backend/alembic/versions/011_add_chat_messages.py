"""Add chat_messages table

Revision ID: 011_add_chat_messages
Revises: 010_add_project_cover_image
Create Date: 2026-03-01


MIT License

Copyright (c) 2025 Banu Andrei & Mircea Levin-Constantin

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
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
    op.create_index("ix_chat_messages_recipient_id", "chat_messages", ["recipient_id"])
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
