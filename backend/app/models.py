"""
SQLAlchemy ORM models for the STRATUM database. Defines all the tables:
users, projects, notes, files, GPS data, invites, activities, QR codes, etc.

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

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import backref, relationship

from app.database import Base


def generate_uuid():
    """Generate a random UUID4 string for use as a primary key default.

    Returns:
        str: A new UUID4 string.
    """
    return str(uuid.uuid4())


class UserRole(str, enum.Enum):
    """Roles a user can hold within a project."""

    LEADER = "leader"
    RESEARCHER = "researcher"
    GUEST = "guest"


class PrivacyLevel(str, enum.Enum):
    """Privacy level for files and notes"""

    PRIVATE = "private"  # Only owner can see
    SHARED = "shared"  # Shared with specific users
    PROJECT = "project"  # All project members can see (default)
    PUBLIC = "public"  # Anyone with project access can see


class ActivityType(str, enum.Enum):
    """Categories of actions recorded in the project activity feed."""

    # Project activities
    PROJECT_CREATED = "project_created"
    PROJECT_UPDATED = "project_updated"
    PROJECT_PUBLICITY_CHANGED = "project_publicity_changed"

    # Member activities
    MEMBER_JOINED = "member_joined"
    MEMBER_LEFT = "member_left"
    MEMBER_ROLE_CHANGED = "member_role_changed"

    # Note activities
    NOTE_CREATED = "note_created"
    NOTE_UPDATED = "note_updated"
    NOTE_DELETED = "note_deleted"
    NOTE_ATTACHMENT_ADDED = "note_attachment_added"
    NOTE_ATTACHMENT_DELETED = "note_attachment_deleted"

    # File activities
    FILE_UPLOADED = "file_uploaded"
    FILE_UPDATED = "file_updated"
    FILE_DELETED = "file_deleted"
    FOLDER_CREATED = "folder_created"
    FOLDER_DELETED = "folder_deleted"
    FILE_MOVED = "file_moved"
    FILE_RENAMED = "file_renamed"

    # Form activities
    CONTEXT_FEATURE_ADDED = "context_feature_added"
    STRATIGRAPHIC_UNIT_ADDED = "stratigraphic_unit_added"
    ARTEFACT_ADDED = "artefact_added"

    # GPS activities
    GPS_UPDATED = "gps_updated"

    # Harris Matrix activities
    HARRIS_MATRIX_UPDATED = "harris_matrix_updated"

    # Wheeler Diagram activities
    WHEELER_DATA_UPDATED = "wheeler_data_updated"

    # Chat activities
    MESSAGE_SENT = "message_sent"


# Association table for project members
project_members = Table(
    "project_members",
    Base.metadata,
    Column("project_id", String, ForeignKey("projects.id", ondelete="CASCADE")),
    Column("user_id", String, ForeignKey("users.id", ondelete="CASCADE")),
    Column("role", SQLEnum(UserRole), default=UserRole.GUEST),
    Column("joined_at", DateTime, default=datetime.utcnow),
)


class User(Base):
    """Registered user account, linked to a Firebase UID."""

    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    firebase_uid = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    username = Column(String, unique=True, nullable=True, index=True)
    display_name = Column(String, nullable=True)
    photo_url = Column(String, nullable=True)
    banner_url = Column(String, nullable=True)
    bio = Column(Text, nullable=True)  # User bio/about me
    description = Column(Text, nullable=True)  # Extended profile description
    phone = Column(String, nullable=True)
    timezone = Column(String, nullable=True)  # e.g. "Europe/Bucharest"
    show_projects = Column(Boolean, default=True, nullable=False)
    # Social links
    link_x = Column(String, nullable=True)  # X (Twitter)
    link_discord = Column(String, nullable=True)
    link_bsky = Column(String, nullable=True)  # Bluesky
    link_linkedin = Column(String, nullable=True)
    link_website = Column(String, nullable=True)  # Personal website
    has_completed_onboarding = Column(Boolean, default=False, nullable=False)
    # eMonument Roles
    auth_provider = Column(String, nullable=True, index=True)
    password_hash = Column(String, nullable=True)
    is_emonument_privileged = Column(Boolean, default=False, nullable=False)
    is_dashboard_admin = Column(Boolean, default=False, nullable=False)
    is_account_disabled = Column(Boolean, default=False, nullable=False)
    is_soft_deleted = Column(Boolean, default=False, nullable=False)
    soft_deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)

    # Relationships
    owned_projects = relationship(
        "Project", back_populates="owner", cascade="all, delete-orphan"
    )
    notes = relationship(
        "Note", back_populates="author", cascade="all, delete-orphan"
    )
    projects = relationship(
        "Project", secondary=project_members, back_populates="members"
    )


class Project(Base):
    """Archaeological project that groups notes, files, GPS data, and members."""

    __tablename__ = "projects"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    ran_lmi_id = Column(String, nullable=True)
    owner_id = Column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    is_public = Column(
        Boolean, default=False
    )  # Whether the project is publicly visible
    cover_image_url = Column(Text, nullable=True)  # MinIO object key for cover image
    harris_matrix_data = Column(
        JSON, nullable=True
    )  # Harris Matrix visualization data
    wheeler_data = Column(JSON, nullable=True)  # Wheeler Stratigraphic Notation data

    # Version tracking for data snapshots (Time Machine support)
    harris_matrix_version = Column(Integer, default=0, nullable=False)
    wheeler_data_version = Column(Integer, default=0, nullable=False)

    # Publication-quality SVG render (stored in MinIO)
    wheeler_render_path = Column(Text, nullable=True)  # MinIO object key
    wheeler_render_version = Column(
        Integer, nullable=True
    )  # data version at render time

    # E2EE encryption key for chat (base64-encoded, shared among members)
    e2ee_key = Column(Text, nullable=True)

    # Public History Review (AI-generated narrative for the published project page)
    public_history_review = Column(Text, nullable=True)
    public_history_provider = Column(String, nullable=True)
    public_history_generated_at = Column(DateTime, nullable=True)
    # True = regenerate on next publish (set when project is unpublished)
    history_needs_refresh = Column(Boolean, default=True, nullable=False)

    # Relationships
    owner = relationship("User", back_populates="owned_projects")
    members = relationship(
        "User", secondary=project_members, back_populates="projects"
    )
    notes = relationship(
        "Note", back_populates="project", cascade="all, delete-orphan"
    )
    files = relationship(
        "FileNode", back_populates="project", cascade="all, delete-orphan"
    )


class Note(Base):
    """User-authored note belonging to a project, with versioning and privacy support."""

    __tablename__ = "notes"

    id = Column(String, primary_key=True, default=generate_uuid)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=True)
    project_id = Column(
        String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    author_id = Column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_synced = Column(DateTime, nullable=True)

    # Versioning fields
    version = Column(Integer, default=1, nullable=False)

    # Privacy fields
    privacy = Column(
        SQLEnum(PrivacyLevel, values_callable=lambda x: [e.value for e in x]),
        default=PrivacyLevel.PROJECT,
        nullable=False,
    )
    shared_with = Column(JSON, nullable=True)  # List of user IDs for SHARED privacy

    # Transcription fields (voice notes only)
    transcription = Column(Text, nullable=True)
    transcription_original = Column(Text, nullable=True)
    transcription_modified = Column(Boolean, default=False, nullable=False)
    transcription_status = Column(
        String, nullable=True
    )  # 'pending' | 'processing' | 'completed' | 'failed'

    # Relationships
    project = relationship("Project", back_populates="notes")
    author = relationship("User", back_populates="notes")
    attachments = relationship(
        "NoteAttachment", back_populates="note", cascade="all, delete-orphan"
    )


class FileNodeType(str, enum.Enum):
    """Discriminator for entries in the file tree (folder, file, or note)."""

    FOLDER = "folder"
    FILE = "file"
    NOTE = "note"


class FileNode(Base):
    """Node in the hierarchical file tree (file, folder, or note-backed entry)."""

    __tablename__ = "file_nodes"

    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(
        String,
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    parent_id = Column(
        String,
        ForeignKey("file_nodes.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    name = Column(String, nullable=False)
    type = Column(SQLEnum(FileNodeType), nullable=False, default=FileNodeType.FILE)
    mime_type = Column(String, nullable=True)
    size = Column(String, nullable=True)
    storage_path = Column(
        String, nullable=True
    )  # object key/path in MinIO for uploaded files
    is_locked = Column(
        Boolean, default=False
    )  # for non-deletable/non-movable nodes like Notes folder or note nodes

    # Versioning fields
    version = Column(
        Integer, default=1, nullable=False
    )  # Incremented on each update
    checksum = Column(
        String, nullable=True
    )  # MD5/SHA256 hash for integrity checking

    # Privacy/Ownership fields
    owner_id = Column(
        String,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )  # File owner
    privacy = Column(
        SQLEnum(PrivacyLevel, values_callable=lambda x: [e.value for e in x]),
        default=PrivacyLevel.PROJECT,
        nullable=False,
    )
    shared_with = Column(
        JSON, nullable=True
    )  # List of user IDs for SHARED privacy: ["user_id_1", "user_id_2"]

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    project = relationship("Project", back_populates="files")
    parent = relationship(
        "FileNode",
        remote_side="FileNode.id",
        backref=backref("children", cascade="all, delete-orphan"),
    )
    owner = relationship("User", foreign_keys=[owner_id])
    versions = relationship(
        "FileVersion", back_populates="file_node", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint(
            "project_id", "parent_id", "name", name="uq_file_nodes_sibling_name"
        ),
        Index("ix_file_nodes_project_parent", "project_id", "parent_id"),
        Index("ix_file_nodes_owner", "owner_id"),
    )


class FileVersion(Base):
    """Stores version history for files - keeps previous versions when files are updated"""

    __tablename__ = "file_versions"

    id = Column(String, primary_key=True, default=generate_uuid)
    file_node_id = Column(
        String,
        ForeignKey("file_nodes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version = Column(Integer, nullable=False)
    storage_path = Column(String, nullable=False)  # MinIO path for this version
    size = Column(String, nullable=True)
    checksum = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(
        String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    file_node = relationship("FileNode", back_populates="versions")
    user = relationship("User", foreign_keys=[created_by])

    __table_args__ = (
        UniqueConstraint("file_node_id", "version", name="uq_file_version"),
        Index("ix_file_versions_file_node", "file_node_id"),
    )


class NoteFileLink(Base):
    """Association linking a Note to its corresponding FileNode in the file tree."""

    __tablename__ = "note_file_links"

    note_id = Column(
        String, ForeignKey("notes.id", ondelete="CASCADE"), primary_key=True
    )
    file_node_id = Column(
        String,
        ForeignKey("file_nodes.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )

    # Relationships
    note = relationship(
        "Note",
        backref=backref("file_link", uselist=False, cascade="all, delete-orphan"),
    )
    file_node = relationship(
        "FileNode",
        backref=backref("note_link", uselist=False, cascade="all, delete-orphan"),
    )


class NoteAttachment(Base):
    """Image or file attached to a note, stored in MinIO."""

    __tablename__ = "note_attachments"

    id = Column(String, primary_key=True, default=generate_uuid)
    note_id = Column(
        String, ForeignKey("notes.id", ondelete="CASCADE"), nullable=False
    )
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)  # Path in MinIO
    file_type = Column(String, nullable=False)  # image/jpeg, image/png, etc.
    file_size = Column(String, nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    note = relationship("Note", back_populates="attachments")


class ProjectGPS(Base):
    """GPS/GIS polygon data for a project (work area and site boundaries)."""

    __tablename__ = "project_gps"

    # One row per project
    project_id = Column(
        String, ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True
    )
    data = Column(
        Text, nullable=False, default="{}"
    )  # JSON blob: { work: {points, closed}, sites: [{points, closed}] }
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship not strictly needed, but can be useful
    project = relationship(
        "Project",
        backref=backref("gps", uselist=False, cascade="all, delete-orphan"),
    )


class ProjectInvite(Base):
    """Invitation token/code that grants a user membership in a project."""

    __tablename__ = "project_invites"

    token = Column(String, primary_key=True, default=generate_uuid)
    code = Column(
        String, unique=True, nullable=True, index=True
    )  # Short code like "PRJ-ABC123"
    project_id = Column(
        String,
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role = Column(SQLEnum(UserRole), nullable=False, default=UserRole.GUEST)
    created_by = Column(
        String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)
    redeemed_by = Column(
        String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    redeemed_at = Column(DateTime, nullable=True)
    used = Column(Boolean, default=False)
    # Multi-use invite support
    max_uses = Column(Integer, nullable=True)  # None = unlimited uses
    use_count = Column(Integer, default=0)  # How many times redeemed

    # Relationships (optional)
    project = relationship(
        "Project", backref=backref("invites", cascade="all, delete-orphan")
    )


class ProjectActivity(Base):
    """Timestamped activity log entry for audit and feed display."""

    __tablename__ = "project_activities"

    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(
        String,
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )  # Can be null if user deleted
    activity_type = Column(SQLEnum(ActivityType), nullable=False)
    description = Column(Text, nullable=False)  # Human-readable description
    extra_data = Column(Text, nullable=True)  # JSON blob for additional data
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    project = relationship(
        "Project", backref=backref("activities", cascade="all, delete-orphan")
    )
    user = relationship("User")

    __table_args__ = (
        Index("ix_project_activities_project_created", "project_id", "created_at"),
    )


class QRCode(Base):
    """
    Unified QR-code registry.

    Every QR code in the app encodes a short unique identifier (e.g. STR-X7K9M2P4).
    This table maps that code to the resource it represents.
    """

    __tablename__ = "qr_codes"

    id = Column(String, primary_key=True, default=generate_uuid)
    code = Column(String, unique=True, nullable=False, index=True)
    type = Column(String, nullable=False)  # "artefact", "invite", …
    resource_id = Column(String, nullable=False)  # target entity id
    project_id = Column(
        String,
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    metadata_json = Column(JSON, nullable=True)
    created_by = Column(
        String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship(
        "Project", backref=backref("qr_codes", cascade="all, delete-orphan")
    )


# ── Channels & User Groups ───────────────────────────────────────────────────


class Channel(Base):
    """A named chat channel within a project (like Slack channels)."""

    __tablename__ = "channels"

    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(
        String,
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String, nullable=False)  # e.g. "general", "finds-log"
    description = Column(Text, nullable=True)
    is_default = Column(
        Boolean, default=False, nullable=False
    )  # The #general channel
    created_by = Column(
        String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    project = relationship(
        "Project", backref=backref("channels", cascade="all, delete-orphan")
    )
    creator = relationship("User", foreign_keys=[created_by])
    members = relationship(
        "ChannelMember", back_populates="channel", cascade="all, delete-orphan"
    )
    messages = relationship(
        "ChatMessage", back_populates="channel", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("project_id", "name", name="uq_channel_name_per_project"),
    )


class ChannelMember(Base):
    """Membership of a user in a channel."""

    __tablename__ = "channel_members"

    channel_id = Column(
        String, ForeignKey("channels.id", ondelete="CASCADE"), primary_key=True
    )
    user_id = Column(
        String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    added_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    channel = relationship("Channel", back_populates="members")
    user = relationship("User")


class UserGroup(Base):
    """Named group of users within a project (for permissions and @mentions)."""

    __tablename__ = "user_groups"

    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(
        String,
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String, nullable=False)  # e.g. "field-leads", "lab-team"
    created_by = Column(
        String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    project = relationship(
        "Project", backref=backref("user_groups", cascade="all, delete-orphan")
    )
    creator = relationship("User", foreign_keys=[created_by])
    members = relationship(
        "UserGroupMember", back_populates="group", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint(
            "project_id", "name", name="uq_user_group_name_per_project"
        ),
    )


class UserGroupMember(Base):
    """Membership of a user in a user group."""

    __tablename__ = "user_group_members"

    group_id = Column(
        String, ForeignKey("user_groups.id", ondelete="CASCADE"), primary_key=True
    )
    user_id = Column(
        String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    added_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    group = relationship("UserGroup", back_populates="members")
    user = relationship("User")


class ChatMessage(Base):
    """A single chat message — channel message, project room message, or DM.

    * channel_id set  → channel message (Slack-like)
    * project_id set + channel_id NULL + recipient_id NULL  → legacy project room
    * recipient_id set  → direct message
    """

    __tablename__ = "chat_messages"

    id = Column(String, primary_key=True, default=generate_uuid)
    sender_id = Column(
        String,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Channel message (primary method for project chat)
    channel_id = Column(
        String,
        ForeignKey("channels.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    # Legacy: Non-null for project room messages without channels
    project_id = Column(
        String,
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    # Non-null for DMs
    recipient_id = Column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    content = Column(Text, nullable=False)
    # @ mentions stored as JSON: [{"type":"user","id":"...", "display":"@name"}, {"type":"group","id":"...","display":"@group"}]
    mentions = Column(JSON, nullable=True)
    # Optional reply-to support (like Slack threads)
    reply_to_id = Column(
        String, ForeignKey("chat_messages.id", ondelete="SET NULL"), nullable=True
    )
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    edited_at = Column(DateTime, nullable=True)
    is_deleted = Column(Boolean, default=False)

    # Relationships
    sender = relationship("User", foreign_keys=[sender_id])
    recipient = relationship("User", foreign_keys=[recipient_id])
    channel = relationship("Channel", back_populates="messages")
    project = relationship(
        "Project", backref=backref("chat_messages", cascade="all, delete-orphan")
    )
    reply_to = relationship("ChatMessage", remote_side="ChatMessage.id")

    __table_args__ = (
        Index("ix_chat_messages_channel_created", "channel_id", "created_at"),
        Index("ix_chat_messages_project_created", "project_id", "created_at"),
        Index("ix_chat_messages_dm", "sender_id", "recipient_id", "created_at"),
    )


class DataVersion(Base):
    """Versioned snapshot of project JSON data (Harris Matrix, Wheeler diagram).

    Each time the harris_matrix_data or wheeler_data JSON column is updated,
    the previous value is stored here, enabling the Time Machine to browse
    and restore earlier revisions.
    """

    __tablename__ = "data_versions"

    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(
        String,
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    data_type = Column(String, nullable=False)  # "harris_matrix" or "wheeler"
    version = Column(Integer, nullable=False)
    data = Column(JSON, nullable=True)  # The snapshot payload
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(
        String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    project = relationship(
        "Project", backref=backref("data_versions", cascade="all, delete-orphan")
    )
    user = relationship("User", foreign_keys=[created_by])

    __table_args__ = (
        UniqueConstraint(
            "project_id", "data_type", "version", name="uq_data_version"
        ),
        Index("ix_data_versions_project_type", "project_id", "data_type"),
    )


# =====================================================================
# eMonument Models
# =====================================================================


class DeviceWhitelist(Base):
    """Devices authorized for eMonument offline collection."""

    __tablename__ = "device_whitelist"

    id = Column(String, primary_key=True, default=generate_uuid)
    device_id = Column(String, unique=True, nullable=False, index=True)
    model_name = Column(String, nullable=True)
    user_id = Column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    is_approved = Column(Boolean, default=True)
    last_sync = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship(
        "User", backref=backref("devices", cascade="all, delete-orphan")
    )


class Monument(Base):
    """Monumente Istorice (LMI / ZP)"""

    __tablename__ = "monuments"

    id = Column(String, primary_key=True, default=generate_uuid)
    lmi_code = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    county = Column(String, nullable=True)  # Județ
    locality = Column(String, nullable=True)  # UAT/Localitate
    address = Column(String, nullable=True)
    latitude = Column(String, nullable=True)
    longitude = Column(String, nullable=True)
    status = Column(String, nullable=True)

    # Relationships
    instances = relationship("FisaInstance", back_populates="monument")


class MonumentAllocation(Base):
    """Join table allocating monuments to users for field work"""

    __tablename__ = "monument_allocations"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    monument_id = Column(
        String, ForeignKey("monuments.id", ondelete="CASCADE"), nullable=False
    )
    allocated_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint(
            "user_id", "monument_id", name="uq_user_monument_allocation"
        ),
    )


class FisaInstanceStatus(str, enum.Enum):
    DRAFT = "draft"
    COMPLETAT = "completat"
    FINALIZAT = "finalizat"
    IN_VERIFICARE = "in_verificare"
    IN_APROBARE = "in_aprobare"
    VALIDAT = "validat"
    REINTORS = "reintors"


class FisaInstance(Base):
    """O instanta de fisa (un formular completat pentru un monument)"""

    __tablename__ = "fisa_instances"

    id = Column(String, primary_key=True, default=generate_uuid)
    monument_id = Column(
        String, ForeignKey("monuments.id", ondelete="CASCADE"), nullable=False
    )
    user_id = Column(
        String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )  # whoever collected it
    device_id = Column(
        String,
        ForeignKey("device_whitelist.device_id", ondelete="SET NULL"),
        nullable=True,
    )

    status = Column(
        SQLEnum(FisaInstanceStatus), default=FisaInstanceStatus.DRAFT, nullable=False
    )

    data = Column(JSON, nullable=False, default={})  # all the sections and fields
    version = Column(Integer, default=1, nullable=False)

    rejection_reason = Column(
        Text, nullable=True
    )  # motiv reintoarcere if status == REINTORS

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    monument = relationship("Monument", back_populates="instances")
    user = relationship("User", foreign_keys=[user_id])
    device = relationship("DeviceWhitelist", foreign_keys=[device_id])
    versions = relationship(
        "FisaInstanceVersion",
        back_populates="instance",
        cascade="all, delete-orphan",
        order_by="FisaInstanceVersion.version",
    )


class FisaInstanceVersion(Base):
    """Immutable snapshots for each submitted/updated FisaInstance version."""

    __tablename__ = "fisa_instance_versions"

    id = Column(String, primary_key=True, default=generate_uuid)
    fisa_instance_id = Column(
        String,
        ForeignKey("fisa_instances.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version = Column(Integer, nullable=False)
    status = Column(SQLEnum(FisaInstanceStatus), nullable=False)
    data = Column(JSON, nullable=False, default={})
    rejection_reason = Column(Text, nullable=True)
    changed_by = Column(
        String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    instance = relationship("FisaInstance", back_populates="versions")
    changed_by_user = relationship("User", foreign_keys=[changed_by])

    __table_args__ = (
        UniqueConstraint(
            "fisa_instance_id", "version", name="uq_fisa_instance_version"
        ),
    )


class ProjectAISummary(Base):
    """Persisted AI summary per (project, user) pair."""

    __tablename__ = "project_ai_summaries"

    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(
        String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id = Column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    summary = Column(Text, nullable=False)
    provider = Column(String, nullable=False)
    generated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("project_id", "user_id", name="uq_project_user_ai_summary"),
    )
