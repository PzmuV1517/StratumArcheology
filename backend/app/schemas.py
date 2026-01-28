from datetime import datetime
from enum import Enum
import re

from pydantic import BaseModel, EmailStr, field_validator


class UserRole(str, Enum):
    LEADER = "leader"
    RESEARCHER = "researcher"
    GUEST = "guest"


class PrivacyLevel(str, Enum):
    PRIVATE = "private"  # Only owner can see
    SHARED = "shared"  # Shared with specific users
    PROJECT = "project"  # All project members can see (default)
    PUBLIC = "public"  # Anyone with project access can see


# Auth Schemas
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def password_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Password cannot be empty")
        return v


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: str

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters long")
        if len(v) > 128:
            raise ValueError("Password must be less than 128 characters")
        # Check for at least one letter and one number for basic strength
        if not re.search(r"[a-zA-Z]", v):
            raise ValueError("Password must contain at least one letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one number")
        return v

    @field_validator("display_name")
    @classmethod
    def validate_display_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Display name cannot be empty")
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Display name must be at least 2 characters")
        if len(v) > 100:
            raise ValueError("Display name must be less than 100 characters")
        # Prevent HTML/script injection in display name
        if re.search(r"[<>\"']", v):
            raise ValueError("Display name contains invalid characters")
        return v


class FirebaseTokenRequest(BaseModel):
    firebase_token: str
    display_name: str | None = None


class AuthResponse(BaseModel):
    access_token: str
    user: "UserResponse"


# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    display_name: str | None = None
    photo_url: str | None = None


class UserCreate(UserBase):
    firebase_uid: str


class UserResponse(UserBase):
    id: str
    firebase_uid: str
    created_at: datetime
    last_login: datetime | None = None

    class Config:
        from_attributes = True


class ProfileUpdateRequest(BaseModel):
    display_name: str | None = None
    photo_url: str | None = None


# Project Member Response (includes role from join table)
class ProjectMemberResponse(BaseModel):
    id: str
    email: str
    display_name: str | None = None
    photo_url: str | None = None
    role: UserRole

    class Config:
        from_attributes = True


# Project Schemas
class ProjectBase(BaseModel):
    name: str
    description: str | None = None
    ran_lmi_id: str | None = None


class ProjectCreate(ProjectBase):
    pass


class ProjectResponse(ProjectBase):
    id: str
    owner_id: str
    created_at: datetime
    updated_at: datetime
    is_active: bool

    class Config:
        from_attributes = True


class ProjectWithMembers(ProjectResponse):
    members: list[ProjectMemberResponse] = []


# Project Member Schemas
class ProjectMemberAdd(BaseModel):
    user_id: str
    role: UserRole = UserRole.GUEST


class ProjectMemberUpdate(BaseModel):
    role: UserRole


# Note Schemas
class NoteBase(BaseModel):
    title: str
    content: str | None = None


class NoteCreate(NoteBase):
    project_id: str


class NoteUpdate(BaseModel):
    title: str | None = None
    content: str | None = None


class NoteAttachmentResponse(BaseModel):
    id: str
    filename: str
    file_type: str
    file_size: str | None = None
    uploaded_at: datetime
    url: str | None = None  # Presigned URL

    class Config:
        from_attributes = True


class NoteResponse(NoteBase):
    id: str
    project_id: str
    author_id: str
    created_at: datetime
    updated_at: datetime
    last_synced: datetime | None = None
    version: int = 1
    privacy: PrivacyLevel = PrivacyLevel.PROJECT
    shared_with: list[str] | None = None
    attachments: list[NoteAttachmentResponse] = []

    class Config:
        from_attributes = True


class NoteUpdateWithPrivacy(BaseModel):
    title: str | None = None
    content: str | None = None
    privacy: PrivacyLevel | None = None
    shared_with: list[str] | None = None


# Sync Schemas
class SyncConflict(BaseModel):
    resource_type: str  # "note", "attachment", etc.
    resource_id: str
    local_updated_at: datetime
    cloud_updated_at: datetime
    resolution: str  # "overwrite_cloud" or "overwrite_local"


class SyncRequest(BaseModel):
    conflicts: list[SyncConflict]


# Authentication Schemas
class TokenData(BaseModel):
    firebase_uid: str
    email: str


# File System Schemas
class FileNodeType(str, Enum):
    folder = "folder"
    file = "file"
    note = "note"


class FileNodeBase(BaseModel):
    id: str
    project_id: str
    parent_id: str | None = None
    name: str
    type: FileNodeType
    mime_type: str | None = None
    size: str | None = None
    is_locked: bool = False
    version: int = 1
    checksum: str | None = None
    owner_id: str | None = None
    privacy: PrivacyLevel = PrivacyLevel.PROJECT
    shared_with: list[str] | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FileVersionResponse(BaseModel):
    id: str
    file_node_id: str
    version: int
    storage_path: str
    size: str | None = None
    checksum: str | None = None
    created_at: datetime
    created_by: str | None = None

    class Config:
        from_attributes = True


class FileNodeWithVersions(FileNodeBase):
    versions: list[FileVersionResponse] = []


class FileNodeCreateFolder(BaseModel):
    name: str
    parent_id: str | None = None


class FileNodeRenameRequest(BaseModel):
    name: str


class FileNodeMoveRequest(BaseModel):
    new_parent_id: str | None = None


class FilePrivacyUpdateRequest(BaseModel):
    privacy: PrivacyLevel
    shared_with: list[str] | None = None  # List of user IDs for SHARED privacy


class ShareWithUsersRequest(BaseModel):
    user_ids: list[str]


class SharedFilesResponse(BaseModel):
    shared_with_me: list[FileNodeBase]
    shared_by_me: list[FileNodeBase]


class SharedNotesResponse(BaseModel):
    shared_with_me: list["NoteResponse"]
    shared_by_me: list["NoteResponse"]


# Invite Schemas
class InviteCreateRequest(BaseModel):
    role: UserRole = UserRole.GUEST
    ttl_hours: int | None = None  # optional time-to-live in hours, default 14 days
    max_uses: int | None = (
        None  # None = unlimited uses, otherwise limit to this many redemptions
    )


class InviteResponse(BaseModel):
    token: str
    code: str  # Short code like "PRJ-ABC123"
    project_id: str
    role: str
    expires_at: datetime | None = None
    max_uses: int | None = None  # None = unlimited
    use_count: int = 0  # How many times used
    accept_path: str  # client path such as /invite?token=...


class InviteAcceptRequest(BaseModel):
    token: str


class InviteJoinByCodeRequest(BaseModel):
    code: str


class InviteAcceptResponse(BaseModel):
    project_id: str
    user_id: str
    role: str
