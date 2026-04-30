"""

Pydantic schemas for request validation and response models.
This file defines the data structures used across the application for users, projects,
notes, files, invites, and more.

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

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, EmailStr, field_validator


class UserRole(str, Enum):
    LEADER = "leader"
    RESEARCHER = "researcher"
    GUEST = "guest"


# PrivacyLevel was removed in migration 021. Access is now governed by
# the ACL model defined below (ACLPrincipalEntry, ACLState).


# Auth Schemas
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: str
    username: str


class FirebaseTokenRequest(BaseModel):
    firebase_token: str
    display_name: str | None = None


class AuthResponse(BaseModel):
    access_token: str | None = None
    user: "UserResponse"
    verification_required: bool = False
    message: str | None = None


# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    username: str | None = None
    display_name: str | None = None
    photo_url: str | None = None
    banner_url: str | None = None
    bio: str | None = None
    description: str | None = None
    phone: str | None = None
    timezone: str | None = None
    show_projects: bool = True
    link_x: str | None = None
    link_discord: str | None = None
    link_bsky: str | None = None
    link_linkedin: str | None = None
    link_website: str | None = None


class UserCreate(UserBase):
    firebase_uid: str


class UserResponse(UserBase):
    id: str
    firebase_uid: str
    auth_provider: str | None = None
    has_completed_onboarding: bool = False
    is_emonument_privileged: bool = False
    is_dashboard_admin: bool = False
    is_account_disabled: bool = False
    is_soft_deleted: bool = False
    soft_deleted_at: datetime | None = None
    is_maintainer: bool = False
    created_at: datetime
    last_login: datetime | None = None

    @field_validator("photo_url", "banner_url", mode="before")
    @classmethod
    def _resolve_urls(cls, v: str | None) -> str | None:
        from app.minio_client import resolve_storage_url

        return resolve_storage_url(v)

    class Config:
        from_attributes = True


class ProfileUpdateRequest(BaseModel):
    username: str | None = None
    display_name: str | None = None
    photo_url: str | None = None
    banner_url: str | None = None
    bio: str | None = None
    description: str | None = None
    phone: str | None = None
    timezone: str | None = None
    show_projects: bool | None = None
    link_x: str | None = None
    link_discord: str | None = None
    link_bsky: str | None = None
    link_linkedin: str | None = None
    link_website: str | None = None


# Project Member Response (includes role from join table)
class ProjectMemberResponse(BaseModel):
    id: str
    email: str
    display_name: str | None = None
    photo_url: str | None = None
    bio: str | None = None
    role: UserRole

    @field_validator("photo_url", mode="before")
    @classmethod
    def _resolve_urls(cls, v: str | None) -> str | None:
        from app.minio_client import resolve_storage_url

        return resolve_storage_url(v)

    class Config:
        from_attributes = True


# Project Schemas
class ProjectBase(BaseModel):
    name: str
    description: str | None = None
    ran_lmi_id: str | None = None
    cover_image_url: str | None = None
    is_public: bool = False


class ProjectCreate(ProjectBase):
    pass


class ProjectResponse(ProjectBase):
    id: str
    owner_id: str
    created_at: datetime
    updated_at: datetime
    is_active: bool

    @field_validator("cover_image_url", mode="before")
    @classmethod
    def _resolve_cover_url(cls, v: str | None) -> str | None:
        from app.minio_client import resolve_storage_url

        return resolve_storage_url(v)

    class Config:
        from_attributes = True


class ProjectWithMembers(ProjectResponse):
    members: list[ProjectMemberResponse] = []


class PublicProjectResponse(ProjectResponse):
    """Public project with member count for popularity ranking."""

    member_count: int = 0


class PublicProjectDetailResponse(PublicProjectResponse):
    """Full public project detail: includes members, GPS bounds, and AI history review."""

    members: list[ProjectMemberResponse] = []
    gps: dict | None = None
    public_history_review: str | None = None
    public_history_provider: str | None = None
    public_history_generated_at: datetime | None = None


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
    parent_id: str | None = None
    is_voice: bool | None = None


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
    attachments: list[NoteAttachmentResponse] = []
    transcription: str | None = None
    transcription_original: str | None = None
    transcription_modified: bool = False
    transcription_status: str | None = None
    # Effective access summary on the linked FileNode mirror. Populated
    # by the route handler so the client can render lock icons without
    # a second round-trip.
    file_node_id: str | None = None
    effective_access: "EffectiveAccess | None" = None

    class Config:
        from_attributes = True


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


class EffectiveAccess(BaseModel):
    """Compact summary of a node's resolved permissions for the calling user.

    Sent on every file/note/folder response so the UI can render lock
    icons, edit/share buttons, and "inherited from <folder>" badges
    without a second round-trip.
    """

    can_read: bool
    can_write: bool
    is_acl_root: bool
    acl_root_id: str | None = None
    acl_root_name: str | None = None
    is_owner_override: bool = False
    is_admin_override: bool = False
    is_project_default: bool = True
    is_acl_root_owner: bool = False


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
    is_acl_root: bool = False
    acl_root_id: str | None = None
    created_at: datetime
    updated_at: datetime
    # Populated by route handlers, not from the ORM directly.
    effective_access: EffectiveAccess | None = None

    class Config:
        from_attributes = True


class FileNodeCreateFolder(BaseModel):
    name: str
    parent_id: str | None = None


class FileNodeRenameRequest(BaseModel):
    name: str


class FileNodeMoveRequest(BaseModel):
    new_parent_id: str | None = None


# ---- ACL request / response schemas ----------------------------------------


class ACLPrincipalEntry(BaseModel):
    """One row in the ACL UI: a user or group with their effective rights.

    Exactly one of ``user_id`` / ``group_id`` is set. ``can_write``
    implies ``can_read`` (enforced both at the API layer and by a DB
    CHECK constraint).
    """

    user_id: str | None = None
    group_id: str | None = None
    can_read: bool = True
    can_write: bool = False
    inherited_from_node_id: str | None = None
    # Display fields (filled on read, ignored on write)
    display_name: str | None = None
    photo_url: str | None = None
    role: str | None = None  # the project role for users (leader/researcher/guest)


class ACLState(BaseModel):
    """Full ACL view for a single node.

    ``is_acl_root`` distinguishes a node that defines its own ACL from
    one that's inheriting. ``entries`` is empty when the node has no
    explicit rules; in that case ``inherits_from`` points at whichever
    ancestor (if any) currently governs access.
    """

    file_node_id: str
    is_acl_root: bool
    inherits_from: str | None = None
    entries: list[ACLPrincipalEntry] = []


class ACLPutRequest(BaseModel):
    """Replace the ACL for a node in one shot.

    Setting ``is_acl_root=False`` clears any rules and re-inherits from
    the parent. Setting ``is_acl_root=True`` with an empty list grants
    nobody but the owner / project leader access (private folder).
    """

    is_acl_root: bool
    entries: list[ACLPrincipalEntry] = []


class ACLShareRequest(BaseModel):
    """Convenience: add (or update) a single principal on a node."""

    user_id: str | None = None
    group_id: str | None = None
    can_read: bool = True
    can_write: bool = False


# ---- Snapshot / History schemas --------------------------------------------


class SnapshotResponse(BaseModel):
    id: str
    project_id: str
    node_id: str | None = None
    kind: str
    version: int
    actor_id: str | None = None
    actor_display_name: str | None = None
    actor_photo_url: str | None = None
    reason: str
    summary: str | None = None
    created_at: datetime
    name_at_snapshot: str | None = None
    path_at_snapshot: str | None = None
    blob_sha256: str | None = None
    is_revertible: bool = True

    class Config:
        from_attributes = True


class HistoryTimelineResponse(BaseModel):
    project_id: str
    total: int
    snapshots: list[SnapshotResponse]


class DeletedNodeResponse(BaseModel):
    """A node sitting in the recycle bin, recoverable for 7 days."""

    snapshot_id: str
    node_id: str | None = None
    name: str
    type: str
    parent_id_at_snapshot: str | None = None
    path_at_snapshot: str | None = None
    deleted_at: datetime
    deleted_by_id: str | None = None
    deleted_by_display_name: str | None = None
    expires_at: datetime  # deleted_at + 7 days


class RestoreRequest(BaseModel):
    """Restore a single snapshot. For ``force=True``, the caller
    acknowledges that newer changes by other users will be overwritten."""

    force: bool = False


class RestoreBatchRequest(BaseModel):
    snapshot_ids: list[str]
    force: bool = False


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


# ── Chat / Messaging Schemas ─────────────────────────────────────────────────


class ChatMessageCreate(BaseModel):
    """Body for sending a new chat message."""

    content: str
    # Channel message (primary), project room (legacy), or DM
    channel_id: str | None = None
    project_id: str | None = None
    recipient_id: str | None = None
    reply_to_id: str | None = None
    mentions: list[dict] | None = (
        None  # [{"type":"user","id":"...","display":"@name"}]
    )


class ChatMessageEdit(BaseModel):
    """Body for editing an existing message."""

    content: str


class ChatMessageResponse(BaseModel):
    """Single chat message returned from REST or WS."""

    id: str
    sender_id: str
    sender_name: str | None = None
    sender_photo: str | None = None
    sender_username: str | None = None
    channel_id: str | None = None
    project_id: str | None = None
    recipient_id: str | None = None
    content: str
    mentions: list[dict] | None = None
    reply_to_id: str | None = None
    created_at: datetime
    edited_at: datetime | None = None
    is_deleted: bool = False

    @field_validator("sender_photo", mode="before")
    @classmethod
    def _resolve_urls(cls, v: str | None) -> str | None:
        from app.minio_client import resolve_storage_url

        return resolve_storage_url(v)

    class Config:
        from_attributes = True


class ChatMessagePage(BaseModel):
    """Paginated list of messages (cursor-based)."""

    messages: list[ChatMessageResponse]
    next_cursor: str | None = None  # ISO timestamp of last message
    has_more: bool = False


class ConversationPreview(BaseModel):
    """Summary row for the DM inbox / conversation list."""

    other_user_id: str
    other_user_name: str | None = None
    other_user_photo: str | None = None
    other_user_username: str | None = None
    last_message: str
    last_message_at: datetime
    unread_count: int = 0

    @field_validator("other_user_photo", mode="before")
    @classmethod
    def _resolve_urls(cls, v: str | None) -> str | None:
        from app.minio_client import resolve_storage_url

        return resolve_storage_url(v)


# ── Channel Schemas ──────────────────────────────────────────────────────────


class ChannelCreate(BaseModel):
    name: str
    description: str | None = None


class ChannelUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class ChannelMemberAdd(BaseModel):
    user_ids: list[str] = []
    group_ids: list[str] = []  # Add all members of these user groups


class ChannelResponse(BaseModel):
    id: str
    project_id: str
    name: str
    description: str | None = None
    is_default: bool
    created_by: str | None = None
    created_at: datetime
    member_count: int = 0

    class Config:
        from_attributes = True


# ── User Group Schemas ───────────────────────────────────────────────────────


class UserGroupCreate(BaseModel):
    name: str


class UserGroupMemberAdd(BaseModel):
    user_ids: list[str]


class UserGroupResponse(BaseModel):
    id: str
    project_id: str
    name: str
    created_by: str | None = None
    created_at: datetime
    member_count: int = 0

    class Config:
        from_attributes = True


class UserGroupWithMembers(UserGroupResponse):
    members: list["ProjectMemberResponse"] = []
