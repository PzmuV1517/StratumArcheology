from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from enum import Enum


class UserRole(str, Enum):
    LEADER = "leader"
    RESEARCHER = "researcher"
    GUEST = "guest"


class PrivacyLevel(str, Enum):
    PRIVATE = "private"      # Only owner can see
    SHARED = "shared"        # Shared with specific users
    PROJECT = "project"      # All project members can see (default)
    PUBLIC = "public"        # Anyone with project access can see


# Auth Schemas
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: str


class FirebaseTokenRequest(BaseModel):
    firebase_token: str
    display_name: Optional[str] = None


class AuthResponse(BaseModel):
    access_token: str
    user: 'UserResponse'


# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    display_name: Optional[str] = None
    photo_url: Optional[str] = None


class UserCreate(UserBase):
    firebase_uid: str


class UserResponse(UserBase):
    id: str
    firebase_uid: str
    created_at: datetime
    last_login: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class ProfileUpdateRequest(BaseModel):
    display_name: Optional[str] = None
    photo_url: Optional[str] = None


# Project Member Response (includes role from join table)
class ProjectMemberResponse(BaseModel):
    id: str
    email: str
    display_name: Optional[str] = None
    photo_url: Optional[str] = None
    role: UserRole
    
    class Config:
        from_attributes = True


# Project Schemas
class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None
    ran_lmi_id: Optional[str] = None


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
    members: List[ProjectMemberResponse] = []


# Project Member Schemas
class ProjectMemberAdd(BaseModel):
    user_id: str
    role: UserRole = UserRole.GUEST


class ProjectMemberUpdate(BaseModel):
    role: UserRole


# Note Schemas
class NoteBase(BaseModel):
    title: str
    content: Optional[str] = None


class NoteCreate(NoteBase):
    project_id: str


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None


class NoteAttachmentResponse(BaseModel):
    id: str
    filename: str
    file_type: str
    file_size: Optional[str] = None
    uploaded_at: datetime
    url: Optional[str] = None  # Presigned URL
    
    class Config:
        from_attributes = True


class NoteResponse(NoteBase):
    id: str
    project_id: str
    author_id: str
    created_at: datetime
    updated_at: datetime
    last_synced: Optional[datetime] = None
    version: int = 1
    privacy: PrivacyLevel = PrivacyLevel.PROJECT
    shared_with: Optional[List[str]] = None
    attachments: List[NoteAttachmentResponse] = []
    
    class Config:
        from_attributes = True


class NoteUpdateWithPrivacy(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    privacy: Optional[PrivacyLevel] = None
    shared_with: Optional[List[str]] = None


# Sync Schemas
class SyncConflict(BaseModel):
    resource_type: str  # "note", "attachment", etc.
    resource_id: str
    local_updated_at: datetime
    cloud_updated_at: datetime
    resolution: str  # "overwrite_cloud" or "overwrite_local"


class SyncRequest(BaseModel):
    conflicts: List[SyncConflict]


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
    parent_id: Optional[str] = None
    name: str
    type: FileNodeType
    mime_type: Optional[str] = None
    size: Optional[str] = None
    is_locked: bool = False
    version: int = 1
    checksum: Optional[str] = None
    owner_id: Optional[str] = None
    privacy: PrivacyLevel = PrivacyLevel.PROJECT
    shared_with: Optional[List[str]] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FileVersionResponse(BaseModel):
    id: str
    file_node_id: str
    version: int
    storage_path: str
    size: Optional[str] = None
    checksum: Optional[str] = None
    created_at: datetime
    created_by: Optional[str] = None
    
    class Config:
        from_attributes = True


class FileNodeWithVersions(FileNodeBase):
    versions: List[FileVersionResponse] = []


class FileNodeCreateFolder(BaseModel):
    name: str
    parent_id: Optional[str] = None


class FileNodeRenameRequest(BaseModel):
    name: str


class FileNodeMoveRequest(BaseModel):
    new_parent_id: Optional[str] = None


class FilePrivacyUpdateRequest(BaseModel):
    privacy: PrivacyLevel
    shared_with: Optional[List[str]] = None  # List of user IDs for SHARED privacy


class ShareWithUsersRequest(BaseModel):
    user_ids: List[str]


class SharedFilesResponse(BaseModel):
    shared_with_me: List[FileNodeBase]
    shared_by_me: List[FileNodeBase]


class SharedNotesResponse(BaseModel):
    shared_with_me: List['NoteResponse']
    shared_by_me: List['NoteResponse']


# Invite Schemas
class InviteCreateRequest(BaseModel):
    role: UserRole = UserRole.GUEST
    ttl_hours: Optional[int] = None  # optional time-to-live in hours, default 14 days
    max_uses: Optional[int] = None  # None = unlimited uses, otherwise limit to this many redemptions


class InviteResponse(BaseModel):
    token: str
    code: str  # Short code like "PRJ-ABC123"
    project_id: str
    role: str
    expires_at: Optional[datetime] = None
    max_uses: Optional[int] = None  # None = unlimited
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
