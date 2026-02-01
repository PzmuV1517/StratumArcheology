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
    return str(uuid.uuid4())


class UserRole(str, enum.Enum):
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
    # Project activities
    PROJECT_CREATED = "project_created"
    PROJECT_UPDATED = "project_updated"

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
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    firebase_uid = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    display_name = Column(String, nullable=True)
    photo_url = Column(String, nullable=True)
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
    harris_matrix_data = Column(JSON, nullable=True)  # Harris Matrix visualization data

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

    # Relationships
    project = relationship("Project", back_populates="notes")
    author = relationship("User", back_populates="notes")
    attachments = relationship(
        "NoteAttachment", back_populates="note", cascade="all, delete-orphan"
    )


class FileNodeType(str, enum.Enum):
    FOLDER = "folder"
    FILE = "file"
    NOTE = "note"


class FileNode(Base):
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
