"""
File management API routes.

Handles file uploads, downloads, folder creation, file versioning (Time Machine),
privacy controls, profile pictures, personal folders, and streaming with
HTTP Range support.

STRATUM - Proprietary and Confidential
Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
All rights reserved.
No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
"""

import hashlib
import uuid
from datetime import datetime
from typing import Any, Optional

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
    UploadFile,
    status,
)
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import (
    check_project_permission,
    get_current_user,
    get_current_user_or_token,
)
from app.history import (
    is_content_editable,
    record_create,
    record_delete,
    record_file_content,
    record_folder_metadata,
)
from app.minio_client import minio_client
from app.models import (
    FileNode,
    FileNodeType,
    NoteFileLink,
    Project,
    SnapshotReason,
    User,
)
from app.permissions import (
    PermissionMode,
    assert_perm,
    can_read,
    resolve_permission,
)
from app.schemas import (
    EffectiveAccess,
    FileNodeBase,
    FileNodeCreateFolder,
    FileNodeMoveRequest,
    FileNodeRenameRequest,
)
from app.websocket import emit_content_update, log_activity

router = APIRouter(prefix="/files", tags=["files"])


# =============================================================================
# PROFILE PICTURE UPLOAD
# =============================================================================


@router.post("/profile-picture")
async def upload_profile_picture(
    file: UploadFile,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload a profile picture for the current user"""
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_types)}",
        )

    # Limit file size (5MB)
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum size is 5MB.",
        )

    # Generate unique filename
    ext = file.filename.split(".")[-1] if file.filename else "jpg"
    filename = f"profile_{current_user.id}_{uuid.uuid4().hex[:8]}.{ext}"
    storage_path = f"profiles/{current_user.id}/{filename}"

    # Upload to MinIO
    await minio_client.upload_file(content, storage_path, file.content_type)

    # Store object path (NOT a presigned URL) so it never expires
    current_user.photo_url = storage_path
    db.commit()
    db.refresh(current_user)

    # Return a temporary presigned URL for immediate display
    url = minio_client.get_presigned_url(storage_path)
    return {"url": url, "filename": filename}


# =============================================================================
# BANNER IMAGE UPLOAD
# =============================================================================


@router.post("/banner-image")
async def upload_banner_image(
    file: UploadFile,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload a banner image for the current user"""
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_types)}",
        )

    # Limit file size (10MB for banners)
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum size is 10MB.",
        )

    # Generate unique filename
    ext = file.filename.split(".")[-1] if file.filename else "jpg"
    filename = f"banner_{current_user.id}_{uuid.uuid4().hex[:8]}.{ext}"
    storage_path = f"banners/{current_user.id}/{filename}"

    # Upload to MinIO
    await minio_client.upload_file(content, storage_path, file.content_type)

    # Store object path (NOT a presigned URL) so it never expires
    current_user.banner_url = storage_path
    db.commit()
    db.refresh(current_user)

    # Return a temporary presigned URL for immediate display
    url = minio_client.get_presigned_url(storage_path)
    return {"url": url, "filename": filename}


# =============================================================================
# STORAGE PROXY  –  streams MinIO objects through the API server so mobile
# and remote clients don't need direct access to the MinIO endpoint.
# =============================================================================

# Buckets the proxy is allowed to serve (prevent probing arbitrary buckets).
_ALLOWED_BUCKETS: set[str] = {
    minio_client.bucket_name,  # default bucket (stratum-files)
    "wheeler-renders",
}


@router.get("/storage/{bucket}/{path:path}")
async def storage_proxy(bucket: str, path: str):
    """Stream a MinIO object through the API.

    This makes stored files reachable from any device that can reach the
    API, avoiding direct MinIO ``localhost`` presigned URLs.
    """
    if bucket not in _ALLOWED_BUCKETS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    if not minio_client.client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Storage unavailable",
        )

    try:
        response = minio_client.client.get_object(bucket, path)
        content_type = response.headers.get(
            "Content-Type", "application/octet-stream"
        )

        def _iterfile():
            try:
                for chunk in response.stream(8192):
                    yield chunk
            finally:
                response.close()
                response.release_conn()

        return StreamingResponse(
            _iterfile(),
            media_type=content_type,
            headers={"Cache-Control": "public, max-age=3600"},
        )
    except Exception as exc:
        # Catch S3Error or anything else – return 404 for missing keys
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found",
        ) from exc


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================


def __compute_checksum(file: UploadFile) -> str:
    """Compute SHA256 checksum of an uploaded file"""
    hash_sha256 = hashlib.sha256()
    for chunk in iter(lambda: file.file.read(8192), b""):
        hash_sha256.update(chunk)
    # Reset file pointer to the beginning after reading
    file.file.seek(0)
    return hash_sha256.hexdigest()


def can_access_file(file_node: FileNode, user: User, db: Session) -> bool:
    """Backward-compatible read-perm check. Delegates to the new ACL
    resolver in :mod:`app.permissions`.

    Kept as a thin shim so all the existing call sites in this file
    continue to work; new code should call ``permissions.can_read``
    or ``permissions.assert_perm`` directly.
    """
    return can_read(db, file_node, user)


def _build_effective_access(
    db: Session, node: FileNode, user: User
) -> EffectiveAccess:
    """Build the lightweight permission summary that ships on every
    file/folder/note response. Used by the UI for lock icons and the
    'inherits from' badge."""
    perm = resolve_permission(db, node, user)
    acl_root_name: str | None = None
    if perm.acl_root_id and perm.acl_root_id != node.id:
        anchor = db.get(FileNode, perm.acl_root_id)
        acl_root_name = anchor.name if anchor else None
    elif perm.acl_root_id == node.id:
        acl_root_name = node.name
    return EffectiveAccess(
        can_read=perm.can_read,
        can_write=perm.can_write,
        is_acl_root=node.is_acl_root,
        acl_root_id=perm.acl_root_id,
        acl_root_name=acl_root_name,
        is_owner_override=perm.is_owner_override,
        is_admin_override=perm.is_admin_override,
        is_project_default=perm.is_project_default,
        is_acl_root_owner=perm.is_acl_root_owner,
    )


def _decorate_node(
    db: Session, node: FileNode, user: User
) -> FileNode:
    """Attach ``effective_access`` to a FileNode for response serialisation.

    Pydantic's ``from_attributes`` will pick the field up off the ORM
    object via attribute access, so we set it as a transient attribute
    rather than a real column.
    """
    setattr(node, "effective_access", _build_effective_access(db, node, user))
    return node


# =============================================================================
# RESPONSE MODELS
# =============================================================================
#
# The legacy ``FileWithVersionsResponse`` and ``TimeMachineResponse`` were
# removed when the Time Machine was rebuilt. Per-node and per-project
# history now lives in :mod:`app.routes.history` and reads from the
# unified ``node_snapshots`` table.


def get_file_category(mime_type: str | None, name: str) -> str:
    """Categorize files based on mime type or extension"""
    if not mime_type:
        # Fallback to extension
        ext = name.lower().split(".")[-1] if "." in name else ""
        ext_categories = {
            "documents": ["doc", "docx", "pdf", "odt", "rtf", "txt", "md"],
            "spreadsheets": ["xls", "xlsx", "csv", "ods"],
            "images": [
                "jpg",
                "jpeg",
                "png",
                "gif",
                "bmp",
                "svg",
                "webp",
                "tiff",
                "tif",
            ],
            "videos": ["mp4", "mov", "avi", "mkv", "webm", "wmv"],
            "audio": ["mp3", "wav", "ogg", "flac", "aac", "m4a"],
            "3d_models": [
                "obj",
                "ply",
                "stl",
                "fbx",
                "gltf",
                "glb",
                "xyz",
                "las",
                "laz",
                "e57",
                "pts",
            ],
            "archives": ["zip", "rar", "7z", "tar", "gz"],
            "code": ["py", "js", "ts", "json", "xml", "html", "css"],
        }
        for category, extensions in ext_categories.items():
            if ext in extensions:
                return category
        return "other"

    mime_categories = {
        "documents": [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats",
            "text/plain",
            "text/markdown",
        ],
        "spreadsheets": [
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml",
            "text/csv",
        ],
        "images": ["image/"],
        "videos": ["video/"],
        "audio": ["audio/"],
        "3d_models": ["model/", "application/sla", "application/x-ply"],
        "archives": ["application/zip", "application/x-rar", "application/x-7z"],
    }

    for category, patterns in mime_categories.items():
        for pattern in patterns:
            if mime_type.startswith(pattern):
                return category
    return "other"


# Time Machine endpoint moved to /history/project/{project_id} in
# app/routes/history.py - see that module for the unified timeline.


@router.post(
    "/project/{project_id}/my-folder",
    response_model=FileNodeBase,
    status_code=status.HTTP_201_CREATED,
)
async def create_my_folder(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a personal folder for the current user in a project.

    The folder lives at ``users/<username>`` (or ``users/<email-prefix>``
    if the user has no username yet) and is marked ``is_acl_root=True``
    with no ACL rows, which means only the owner and the project leader
    have access by default. The owner manages further permissions
    through the standard ``/acl/{node_id}`` endpoints.

    Guests cannot create personal folders.
    """
    from app.models import UserRole, project_members

    check_project_permission(project_id, current_user, db)

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    is_owner = project.owner_id == current_user.id
    member_role = None
    if not is_owner:
        from sqlalchemy import select

        stmt = select(project_members).where(
            project_members.c.project_id == project_id,
            project_members.c.user_id == current_user.id,
        )
        member = db.execute(stmt).first()
        if member:
            member_role = member.role

    if not is_owner and member_role == UserRole.GUEST:
        raise HTTPException(
            status_code=403,
            detail=(
                "Guests cannot create personal folders. Only researchers "
                "and project leaders have a My Folder."
            ),
        )

    users_folder = await ensure_users_folder(project_id, db)

    # One personal folder per user, found by owner_id.
    existing = (
        db.query(FileNode)
        .filter(
            FileNode.project_id == project_id,
            FileNode.owner_id == current_user.id,
            FileNode.parent_id == users_folder.id,
            FileNode.type == FileNodeType.FOLDER,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail="You already have a personal folder in this project",
        )

    # Folder name comes from the user's username so it's both unique and
    # human-friendly. Falls back to the email local-part for users who
    # haven't claimed a username yet, then to the user id as a last
    # resort. We dedupe against existing siblings by appending (1), (2)...
    raw_name = current_user.username or (
        current_user.email.split("@", 1)[0] if current_user.email else None
    )
    base_name = (raw_name or current_user.id).strip().lower() or current_user.id

    candidate = base_name
    counter = 1
    while (
        db.query(FileNode)
        .filter(
            FileNode.project_id == project_id,
            FileNode.parent_id == users_folder.id,
            FileNode.name == candidate,
        )
        .first()
    ):
        counter += 1
        candidate = f"{base_name} ({counter})"

    my_folder = FileNode(
        project_id=project_id,
        parent_id=users_folder.id,
        name=candidate,
        type=FileNodeType.FOLDER,
        owner_id=current_user.id,
        is_acl_root=True,
        is_locked=False,
    )
    db.add(my_folder)
    db.flush()
    # Self-reference for the denormalised root pointer.
    my_folder.acl_root_id = my_folder.id
    db.flush()

    record_create(
        db,
        node=my_folder,
        actor_id=current_user.id,
        summary=f'Created personal folder "{candidate}"',
    )
    db.commit()
    db.refresh(my_folder)

    await log_activity(
        db=db,
        project_id=project_id,
        activity_type="FOLDER_CREATED",
        description=f'Created personal folder "{candidate}"',
        user_id=current_user.id,
        metadata={
            "folder_id": my_folder.id,
            "folder_name": candidate,
            "is_personal": True,
        },
    )
    await emit_content_update(project_id, "files")

    return _decorate_node(db, my_folder, current_user)


# The legacy ``/my-folder/permissions`` endpoints were removed when the
# generic ACL system landed. Permissions on a personal folder (or any
# other folder) are now managed through ``/acl/{node_id}`` in
# ``app/routes/acl.py``.


@router.get("/project/{project_id}/my-folder", response_model=Optional[FileNodeBase])
async def get_my_folder(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the current user's personal folder in a project, if it exists"""
    check_project_permission(project_id, current_user, db)

    # Get the /users folder first
    users_folder = (
        db.query(FileNode)
        .filter(
            FileNode.project_id == project_id,
            FileNode.parent_id == None,
            FileNode.name == "users",
            FileNode.type == FileNodeType.FOLDER,
        )
        .first()
    )

    if not users_folder:
        return None  # No users folder means no personal folders exist yet

    # Find the user's folder inside /users by owner_id
    my_folder = (
        db.query(FileNode)
        .filter(
            FileNode.project_id == project_id,
            FileNode.owner_id == current_user.id,
            FileNode.parent_id == users_folder.id,
            FileNode.type == FileNodeType.FOLDER,
        )
        .first()
    )

    return my_folder


@router.get("/project/{project_id}", response_model=list[FileNodeBase])
async def list_project_root(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List root-level file nodes for a project, filtering by privacy settings"""
    check_project_permission(project_id, current_user, db)

    # Get all root nodes
    nodes = (
        db.query(FileNode)
        .filter(FileNode.project_id == project_id, FileNode.parent_id == None)
        .order_by(FileNode.type.desc(), FileNode.name.asc())
        .all()
    )

    # Filter based on privacy - use can_access_file to respect privacy settings
    accessible_nodes = [
        node for node in nodes if can_access_file(node, current_user, db)
    ]

    return accessible_nodes


@router.get("/{node_id}/children", response_model=list[FileNodeBase])
async def list_children(
    node_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List child file nodes of a folder, filtered by privacy settings.

    Args:
        node_id: The parent folder's UUID.
        current_user: The authenticated user.
        db: Database session.

    Returns:
        List of accessible child file nodes ordered by type then name.

    Raises:
        HTTPException: 404 if folder not found, 403 if access denied.
    """
    node = db.query(FileNode).filter(FileNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Folder not found")
    check_project_permission(node.project_id, current_user, db)

    # Check if user can access the parent folder
    if not can_access_file(node, current_user, db):
        raise HTTPException(status_code=403, detail="Access denied to this folder")

    children = (
        db.query(FileNode)
        .filter(FileNode.parent_id == node_id)
        .order_by(FileNode.type.desc(), FileNode.name.asc())
        .all()
    )

    # Filter children based on privacy
    accessible_children = [
        child for child in children if can_access_file(child, current_user, db)
    ]

    return accessible_children


@router.post(
    "/project/{project_id}/folders",
    response_model=FileNodeBase,
    status_code=status.HTTP_201_CREATED,
)
async def create_folder(
    project_id: str,
    folder: FileNodeCreateFolder,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new folder in a project.

    Handles duplicate folder names by appending (1), (2), etc.

    Args:
        project_id: The project UUID.
        folder: Folder creation data including name and optional parent_id.
        current_user: The authenticated user.
        db: Database session.

    Returns:
        The newly created FileNode folder.

    Raises:
        HTTPException: 404 if parent folder not found, 400 if parent is not a folder.
    """
    check_project_permission(project_id, current_user, db)
    parent = None
    if folder.parent_id:
        parent = (
            db.query(FileNode)
            .filter(
                FileNode.id == folder.parent_id, FileNode.project_id == project_id
            )
            .first()
        )
        if not parent:
            raise HTTPException(status_code=404, detail="Parent folder not found")
        if parent.type != FileNodeType.FOLDER:
            raise HTTPException(status_code=400, detail="Parent must be a folder")

    # Handle duplicate folder names by appending (1), (2), etc.
    base_name = folder.name
    final_name = base_name

    existing = (
        db.query(FileNode)
        .filter(
            FileNode.project_id == project_id,
            FileNode.parent_id == folder.parent_id,
            FileNode.name == final_name,
            FileNode.type == FileNodeType.FOLDER,
        )
        .first()
    )

    if existing:
        counter = 1
        while True:
            final_name = f"{base_name} ({counter})"
            exists = (
                db.query(FileNode)
                .filter(
                    FileNode.project_id == project_id,
                    FileNode.parent_id == folder.parent_id,
                    FileNode.name == final_name,
                    FileNode.type == FileNodeType.FOLDER,
                )
                .first()
            )
            if not exists:
                break
            counter += 1

    node = FileNode(
        project_id=project_id,
        parent_id=folder.parent_id,
        name=final_name,
        type=FileNodeType.FOLDER,
    )
    db.add(node)
    db.commit()
    db.refresh(node)

    # Log activity
    await log_activity(
        db=db,
        project_id=project_id,
        activity_type="FOLDER_CREATED",
        description=f'Created folder "{node.name}"',
        user_id=current_user.id,
        metadata={"folder_id": node.id, "folder_name": node.name},
    )

    # Notify all users in project that files have been updated (folder created)
    await emit_content_update(project_id, "files")

    return node


@router.put("/{node_id}/move", response_model=FileNodeBase)
async def move_node(
    node_id: str,
    move: FileNodeMoveRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Move a file or folder to a new parent folder.

    Args:
        node_id: The UUID of the node to move.
        move: Request body containing the new parent folder ID.
        current_user: The authenticated user.
        db: Database session.

    Returns:
        The updated FileNode.

    Raises:
        HTTPException: 404 if node or new parent not found, 400 if node is
            locked or new parent is not a folder.
    """
    node = db.query(FileNode).filter(FileNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    check_project_permission(node.project_id, current_user, db)
    if node.is_locked:
        raise HTTPException(status_code=400, detail="This node cannot be moved")

    new_parent = None
    if move.new_parent_id:
        new_parent = (
            db.query(FileNode)
            .filter(
                FileNode.id == move.new_parent_id,
                FileNode.project_id == node.project_id,
            )
            .first()
        )
        if not new_parent:
            raise HTTPException(status_code=404, detail="New parent not found")
        if new_parent.type != FileNodeType.FOLDER:
            raise HTTPException(
                status_code=400, detail="New parent must be a folder"
            )

    node.parent_id = move.new_parent_id
    node.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(node)

    # Log activity
    await log_activity(
        db=db,
        project_id=node.project_id,
        activity_type="FILE_MOVED",
        description=f'Moved "{node.name}"',
        user_id=current_user.id,
        metadata={"node_id": node.id, "node_name": node.name},
    )

    # Notify all users in project that files have been updated (file/folder moved)
    await emit_content_update(node.project_id, "files")

    return node


@router.put("/{node_id}/rename", response_model=FileNodeBase)
async def rename_node(
    node_id: str,
    payload: FileNodeRenameRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Rename a file or folder.

    For files, the original extension is preserved regardless of what the
    user supplies. If the node is linked to a Note, the note title is
    updated to match the new filename.

    Args:
        node_id: The UUID of the node to rename.
        payload: Request body containing the new name.
        current_user: The authenticated user.
        db: Database session.

    Returns:
        The updated FileNode.

    Raises:
        HTTPException: 404 if node not found, 400 if node is locked.
    """
    node = db.query(FileNode).filter(FileNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    check_project_permission(node.project_id, current_user, db)
    if node.is_locked:
        raise HTTPException(status_code=400, detail="This node cannot be renamed")
    # Preserve extension for file nodes; users can only change base name
    if node.type == FileNodeType.FILE and node.name:
        # Split existing name
        if "." in node.name and not node.name.startswith("."):
            *base_parts, ext = node.name.rsplit(".", 1)
            old_ext = ext
        else:
            old_ext = None
        # Extract new base (strip any extension user might have typed to avoid changing type)
        new_base = payload.name
        if "." in new_base and not new_base.startswith("."):
            new_base = new_base.rsplit(".", 1)[0]
        node.name = f"{new_base}.{old_ext}" if old_ext else new_base
    else:
        node.name = payload.name

    # If this is a file in the Notes folder, sync the note title
    if node.parent_id:
        parent = db.query(FileNode).filter(FileNode.id == node.parent_id).first()
        if parent and parent.name == "Notes" and node.type == FileNodeType.FILE:
            # This is a file in the Notes folder, check if it's linked to a note
            note_link = (
                db.query(NoteFileLink)
                .filter(NoteFileLink.file_node_id == node.id)
                .first()
            )
            if note_link and note_link.note:
                # Update the note title from the filename
                if node.name.endswith(".txt"):
                    note_link.note.title = node.name[:-4]  # Remove .txt extension
                else:
                    note_link.note.title = node.name
                note_link.note.updated_at = datetime.utcnow()

    node.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(node)

    # Log activity
    await log_activity(
        db=db,
        project_id=node.project_id,
        activity_type="FILE_RENAMED",
        description=f'Renamed to "{node.name}"',
        user_id=current_user.id,
        metadata={"node_id": node.id, "new_name": node.name},
    )

    # Notify all users in project that files have been updated (file/folder renamed)
    await emit_content_update(node.project_id, "files")

    return node


@router.delete("/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_node(
    node_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a file or folder and all its descendants.

    Recursively removes child nodes and their associated storage objects
    from MinIO before deleting the database records.

    Args:
        node_id: The UUID of the node to delete.
        current_user: The authenticated user.
        db: Database session.

    Raises:
        HTTPException: 404 if node not found, 400 if node is locked.
    """
    node = db.query(FileNode).filter(FileNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    check_project_permission(node.project_id, current_user, db)
    if node.is_locked:
        raise HTTPException(status_code=400, detail="This node cannot be deleted")

    # Recursively delete subtree and storage objects
    async def _delete_subtree(n: FileNode):
        # delete children first
        children = db.query(FileNode).filter(FileNode.parent_id == n.id).all()
        for c in children:
            await _delete_subtree(c)
        # delete storage if file
        if n.type == FileNodeType.FILE and n.storage_path:
            await minio_client.delete_file(n.storage_path)
        db.delete(n)

    project_id = node.project_id  # Store before deletion
    node_name = node.name  # Store before deletion
    node_type = node.type  # Store before deletion
    await _delete_subtree(node)
    db.commit()

    # Log activity
    await log_activity(
        db=db,
        project_id=project_id,
        activity_type="FILE_DELETED"
        if node_type == FileNodeType.FILE
        else "FOLDER_DELETED",
        description=f'Deleted {"file" if node_type == FileNodeType.FILE else "folder"} "{node_name}"',
        user_id=current_user.id,
        metadata={"node_name": node_name},
    )

    # Notify all users in project that files have been updated (file/folder deleted)
    await emit_content_update(project_id, "files")

    return None


@router.post(
    "/project/{project_id}/upload",
    response_model=FileNodeBase,
    status_code=status.HTTP_201_CREATED,
)
async def upload_file(
    project_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload a file to a project.

    Parses multipart form data tolerantly, stores the file in MinIO, and
    creates a corresponding FileNode. Duplicate filenames are handled by
    appending (1), (2), etc.

    Args:
        project_id: The project UUID.
        request: The incoming HTTP request containing multipart form data.
        current_user: The authenticated user.
        db: Database session.

    Returns:
        The newly created FileNode.

    Raises:
        HTTPException: 422 if no file found in form, 404 if parent folder
            not found, 400 if parent is not a folder.
    """
    check_project_permission(project_id, current_user, db)

    # Parse form manually to be more tolerant
    form = await request.form()
    print(f"DEBUG: Received form keys: {list(form.keys())}")

    parent_id = form.get("parent_id")
    file = None

    # Find the file in the form
    for key, value in form.items():
        print(
            f"DEBUG: Form field '{key}' type: {type(value)}, value preview: {str(value)[:100] if not isinstance(value, UploadFile) else 'UploadFile'}"
        )
        if hasattr(value, "file"):  # UploadFile check
            file = value
            print(
                f"DEBUG: Found file in field '{key}': {file.filename}, content_type: {file.content_type}"
            )
            break

    if file is None:
        raise HTTPException(
            status_code=422,
            detail=f"No file uploaded. Received keys: {list(form.keys())}",
        )

    parent = None
    if parent_id:
        parent = (
            db.query(FileNode)
            .filter(FileNode.id == parent_id, FileNode.project_id == project_id)
            .first()
        )
        if not parent:
            raise HTTPException(status_code=404, detail="Parent folder not found")
        if parent.type != FileNodeType.FOLDER:
            raise HTTPException(status_code=400, detail="Parent must be a folder")

    data = await file.read()
    object_name = f"files/{project_id}/{uuid.uuid4()}"
    await minio_client.upload_file(data, object_name, file.content_type)

    # Calculate checksum for integrity checking
    file_checksum = hashlib.md5(data).hexdigest()

    # Handle duplicate file names by appending (1), (2), etc.
    base_name = file.filename or "file"
    final_name = base_name

    # Check if a file with this name already exists in the same folder
    existing = (
        db.query(FileNode)
        .filter(
            FileNode.project_id == project_id,
            FileNode.parent_id == parent_id,
            FileNode.name == final_name,
            FileNode.type == FileNodeType.FILE,
        )
        .first()
    )

    if existing:
        # Split name and extension
        if "." in base_name:
            name_part, ext_part = base_name.rsplit(".", 1)
            ext_part = "." + ext_part
        else:
            name_part = base_name
            ext_part = ""

        # Find next available number
        counter = 1
        while True:
            final_name = f"{name_part} ({counter}){ext_part}"
            exists = (
                db.query(FileNode)
                .filter(
                    FileNode.project_id == project_id,
                    FileNode.parent_id == parent_id,
                    FileNode.name == final_name,
                    FileNode.type == FileNodeType.FILE,
                )
                .first()
            )
            if not exists:
                break
            counter += 1

    # Verify the caller can write to the parent before creating the node.
    if parent is not None:
        assert_perm(db, parent, current_user, PermissionMode.WRITE)

    node = FileNode(
        project_id=project_id,
        parent_id=parent_id,
        name=final_name,
        type=FileNodeType.FILE,
        mime_type=file.content_type,
        size=str(len(data)),
        storage_path=object_name,
        version=1,
        checksum=file_checksum,
        owner_id=current_user.id,
    )
    db.add(node)
    db.flush()
    # Inherit acl_root_id from parent so reads stay cheap.
    if parent is not None:
        node.acl_root_id = parent.acl_root_id
    db.flush()

    record_create(
        db,
        node=node,
        actor_id=current_user.id,
        summary=f'Uploaded "{node.name}"',
    )
    # Only snapshot the bytes themselves for editable text-shaped files.
    # Photos, audio, videos, archives etc. have no in-app edit path so
    # there's no point keeping prior copies around.
    if is_content_editable(mime_type=node.mime_type, name=node.name):
        await record_file_content(
            db,
            node=node,
            data=data,
            actor_id=current_user.id,
            reason=SnapshotReason.CREATE,
            summary=f'Initial content of "{node.name}"',
            mime_type=node.mime_type,
        )

    db.commit()
    db.refresh(node)

    await log_activity(
        db=db,
        project_id=project_id,
        activity_type="FILE_UPLOADED",
        description=f'Uploaded file "{node.name}"',
        user_id=current_user.id,
        metadata={
            "file_id": node.id,
            "file_name": node.name,
            "file_size": node.size,
        },
    )

    await emit_content_update(project_id, "files")

    return _decorate_node(db, node, current_user)


@router.get("/{node_id}/download")
async def download_file(
    node_id: str,
    request: Request,
    current_user: User = Depends(get_current_user_or_token),
    db: Session = Depends(get_db),
):
    """Download a file node's content.

    Accepts authentication via Authorization header OR token query parameter.
    Returns a streaming response with appropriate Content-Type and Content-Disposition.
    Supports HTTP Range requests required by iOS AVFoundation (AVPlayer).
    Notes and folders are not downloadable.
    """
    node = db.query(FileNode).filter(FileNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    if node.type != FileNodeType.FILE:
        raise HTTPException(
            status_code=400, detail="Only file nodes can be downloaded"
        )
    check_project_permission(node.project_id, current_user, db)
    if not node.storage_path:
        raise HTTPException(status_code=404, detail="Stored object missing")

    # Get object stat for size
    try:
        stat = minio_client.client.stat_object(
            minio_client.bucket_name, node.storage_path
        )
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to retrieve object")

    filename = node.name or "download"
    media_type = node.mime_type or "application/octet-stream"
    file_size = getattr(stat, "size", None) or 0

    base_headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Accept-Ranges": "bytes",
    }

    # Handle Range requests (required by iOS AVFoundation / AVPlayer)
    range_header = request.headers.get("range")
    if range_header and file_size > 0:
        try:
            range_spec = range_header.replace("bytes=", "")
            parts = range_spec.split("-")
            start = int(parts[0]) if parts[0] else 0
            end = int(parts[1]) if parts[1] else file_size - 1
        except (ValueError, IndexError):
            start = 0
            end = file_size - 1

        start = max(0, start)
        end = min(end, file_size - 1)
        content_length = end - start + 1

        try:
            obj = minio_client.client.get_object(
                minio_client.bucket_name,
                node.storage_path,
                offset=start,
                length=content_length,
            )
        except Exception:
            raise HTTPException(
                status_code=500, detail="Failed to retrieve object range"
            )

        def iterfile_range():
            try:
                for data in obj.stream(32 * 1024):
                    yield data
            finally:
                obj.close()
                obj.release_conn()

        return StreamingResponse(
            iterfile_range(),
            status_code=206,
            media_type=media_type,
            headers={
                **base_headers,
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Content-Length": str(content_length),
            },
        )

    # Full response (no Range header)
    try:
        obj = minio_client.client.get_object(
            minio_client.bucket_name, node.storage_path
        )
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to retrieve object")

    def iterfile():
        try:
            for data in obj.stream(32 * 1024):
                yield data
        finally:
            obj.close()
            obj.release_conn()

    headers = {**base_headers}
    if file_size > 0:
        headers["Content-Length"] = str(file_size)

    return StreamingResponse(iterfile(), media_type=media_type, headers=headers)


@router.put("/{node_id}/content", response_model=FileNodeBase)
async def replace_file_content(
    node_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Replace the bytes of a file node while preserving its name and extension.

    Accepts multipart/form-data with a 'file' field. Updates mime_type and size. Denies locked nodes.
    """
    node = db.query(FileNode).filter(FileNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    if node.type != FileNodeType.FILE:
        raise HTTPException(
            status_code=400, detail="Only file nodes can be replaced"
        )
    check_project_permission(node.project_id, current_user, db)
    assert_perm(db, node, current_user, PermissionMode.WRITE)
    if node.is_locked:
        raise HTTPException(status_code=400, detail="This node cannot be modified")

    form = await request.form()
    new_file = None
    for _key, value in form.items():
        if hasattr(value, "file"):
            new_file = value
            break
    if not new_file:
        raise HTTPException(status_code=422, detail="No file provided")

    data = await new_file.read()

    # Snapshot the *previous* bytes before overwriting them, so the
    # restore-this-version button works. We only do this for content
    # types we'd actually let someone edit; static media (photos, audio,
    # video, archives, etc.) are excluded so we don't accumulate dead
    # copies in object storage.
    if (
        node.storage_path
        and node.version >= 1
        and is_content_editable(mime_type=node.mime_type, name=node.name)
    ):
        prior = await minio_client.get_file(node.storage_path)
        if prior is not None:
            await record_file_content(
                db,
                node=node,
                data=prior,
                actor_id=current_user.id,
                reason=SnapshotReason.EDIT,
                summary=f'Captured pre-edit content of "{node.name}"',
                mime_type=node.mime_type,
            )

    new_storage_path = f"files/{node.project_id}/{uuid.uuid4()}"
    await minio_client.upload_file(
        data,
        new_storage_path,
        new_file.content_type or node.mime_type or "application/octet-stream",
    )

    new_checksum = hashlib.md5(data).hexdigest()

    node.storage_path = new_storage_path
    node.mime_type = new_file.content_type or node.mime_type
    node.size = str(len(data))
    node.checksum = new_checksum
    node.version = node.version + 1
    node.updated_at = datetime.utcnow()

    # Snapshot the *new* bytes too, but only for editable types. The
    # snapshot links the version number to the live blob.
    if is_content_editable(mime_type=node.mime_type, name=node.name):
        await record_file_content(
            db,
            node=node,
            data=data,
            actor_id=current_user.id,
            reason=SnapshotReason.EDIT,
            summary=f'Edited "{node.name}" (v{node.version})',
            mime_type=node.mime_type,
        )

    # If this is a note file, sync the note content
    if node.parent_id:
        parent = db.query(FileNode).filter(FileNode.id == node.parent_id).first()
        if parent and parent.name == "Notes":
            # This is a file in the Notes folder, check if it's linked to a note
            note_link = (
                db.query(NoteFileLink)
                .filter(NoteFileLink.file_node_id == node.id)
                .first()
            )
            if note_link and note_link.note:
                # Update the note content from the file
                try:
                    note_link.note.content = data.decode("utf-8")
                    filename = node.name
                    if filename.endswith(".txt"):
                        note_link.note.title = filename[:-4]  # Remove .txt extension
                    note_link.note.updated_at = datetime.utcnow()
                    note_link.note.version = note_link.note.version + 1
                except UnicodeDecodeError:
                    # If file is not valid UTF-8, don't update note
                    pass
                    pass

    db.commit()
    db.refresh(node)

    # Notify all users in project that files have been updated (file content replaced)
    await emit_content_update(node.project_id, "files")

    return node


# =============================================================================
# Legacy privacy / version / restore endpoints removed.
#
# * ``PUT /{node_id}/privacy``                  -> ``PUT /acl/{node_id}``
# * ``GET /{node_id}/versions``                 -> ``GET /history/node/{node_id}``
# * ``GET /{node_id}/version/{v}/download``     -> per-snapshot stream (TBD UI)
# * ``POST /{node_id}/restore/{v}``             -> ``POST /history/snapshots/{snapshot_id}/restore``
#
# See app/routes/acl.py and app/routes/history.py.
# =============================================================================


# =============================================================================
# USERS FOLDER SYSTEM
# =============================================================================


async def ensure_users_folder(project_id: str, db: Session) -> FileNode:
    """Ensure the 'users' folder exists in project root, create if not.

    The folder itself is project-visible (anyone can navigate into the
    ``users/`` directory). The personal folders inside are each their
    own ACL root and govern their own access.
    """
    users_folder = (
        db.query(FileNode)
        .filter(
            FileNode.project_id == project_id,
            FileNode.parent_id == None,  # noqa: E711
            FileNode.name == "users",
            FileNode.type == FileNodeType.FOLDER,
        )
        .first()
    )

    if not users_folder:
        users_folder = FileNode(
            project_id=project_id,
            parent_id=None,
            name="users",
            type=FileNodeType.FOLDER,
            is_locked=True,
        )
        db.add(users_folder)
        db.commit()
        db.refresh(users_folder)

    return users_folder


# NOTE: get_my_folder endpoint is defined above at line ~394
# The ensure_user_folder helper below is kept for potential future use but
# the duplicate route has been removed to avoid conflicts


@router.get(
    "/project/{project_id}/shared-with-me", response_model=list[FileNodeBase]
)
async def get_files_shared_with_me(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List ACL-rooted nodes that grant the current user explicit access.

    Used by the "Shared with me" tab. Walks every ACL row whose
    ``user_id`` matches the caller (or whose ``group_id`` they belong to)
    and returns the corresponding nodes scoped to this project.
    """
    from app.models import FileNodeACL, UserGroupMember

    check_project_permission(project_id, current_user, db)

    group_ids_q = db.query(UserGroupMember.group_id).filter(
        UserGroupMember.user_id == current_user.id
    )
    group_ids = {r[0] for r in group_ids_q.all() if r[0] is not None}

    acl_q = db.query(FileNodeACL.file_node_id).filter(
        (FileNodeACL.user_id == current_user.id)
        | (FileNodeACL.group_id.in_(group_ids) if group_ids else False)
    )
    target_node_ids = {r[0] for r in acl_q.all()}
    if not target_node_ids:
        return []

    nodes = (
        db.query(FileNode)
        .filter(
            FileNode.project_id == project_id,
            FileNode.id.in_(target_node_ids),
            FileNode.owner_id != current_user.id,
        )
        .all()
    )
    return [_decorate_node(db, n, current_user) for n in nodes]


@router.get("/project/{project_id}/shared-by-me", response_model=list[FileNodeBase])
async def get_files_shared_by_me(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List ACL-rooted nodes the current user owns AND has explicitly
    shared with someone else."""
    from app.models import FileNodeACL

    check_project_permission(project_id, current_user, db)

    owned_acl_root_ids = {
        n.id
        for n in db.query(FileNode)
        .filter(
            FileNode.project_id == project_id,
            FileNode.owner_id == current_user.id,
            FileNode.is_acl_root == True,  # noqa: E712
        )
        .all()
    }
    if not owned_acl_root_ids:
        return []

    acl_with_others = (
        db.query(FileNodeACL.file_node_id)
        .filter(FileNodeACL.file_node_id.in_(owned_acl_root_ids))
        .filter(
            (FileNodeACL.user_id != None)  # noqa: E711
            | (FileNodeACL.group_id != None)  # noqa: E711
        )
        .distinct()
        .all()
    )
    target_ids = {r[0] for r in acl_with_others}
    if not target_ids:
        return []

    nodes = db.query(FileNode).filter(FileNode.id.in_(target_ids)).all()
    return [_decorate_node(db, n, current_user) for n in nodes]


@router.get("/project/{project_id}/users-folder", response_model=list[FileNodeBase])
async def list_users_folder(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List the contents of ``/users`` (every member's personal folder).

    Permission filtering goes through the standard ACL resolver: the
    project owner sees every personal folder, individual members see
    their own folder plus any other members' folders that have shared
    access with them.
    """
    check_project_permission(project_id, current_user, db)

    users_folder = await ensure_users_folder(project_id, db)
    user_folders = (
        db.query(FileNode)
        .filter(
            FileNode.parent_id == users_folder.id,
            FileNode.type == FileNodeType.FOLDER,
        )
        .all()
    )
    visible = [f for f in user_folders if can_read(db, f, current_user)]
    return [_decorate_node(db, n, current_user) for n in visible]


@router.get("/info/{node_id}", response_model=FileNodeBase)
async def get_file_info(
    node_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get file info including version and privacy"""
    node = db.query(FileNode).filter(FileNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    check_project_permission(node.project_id, current_user, db)

    if not can_access_file(node, current_user, db):
        raise HTTPException(status_code=403, detail="Access denied")

    return node


@router.get("/project/{project_id}/files-info", response_model=list[FileNodeBase])
async def get_files_info_batch(
    project_id: str,
    node_ids: str,  # Comma-separated list of node IDs
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get info for multiple files at once (for offline sync)"""
    check_project_permission(project_id, current_user, db)

    ids = [id.strip() for id in node_ids.split(",") if id.strip()]
    if not ids:
        return []

    nodes = (
        db.query(FileNode)
        .filter(FileNode.id.in_(ids), FileNode.project_id == project_id)
        .all()
    )

    # Filter by access
    accessible_nodes = [n for n in nodes if can_access_file(n, current_user, db)]

    return accessible_nodes
