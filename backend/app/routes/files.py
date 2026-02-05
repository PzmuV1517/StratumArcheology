import hashlib
import uuid
from collections import defaultdict
from datetime import datetime
from typing import Any, Optional

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import (
    check_project_permission,
    get_current_user,
    get_current_user_or_token,
)
from app.minio_client import minio_client
from app.models import (
    FileNode,
    FileNodeType,
    FileVersion,
    NoteFileLink,
    PrivacyLevel,
    Project,
    User,
)
from app.schemas import (
    FileNodeBase,
    FileNodeCreateFolder,
    FileNodeMoveRequest,
    FileNodeRenameRequest,
    FilePrivacyUpdateRequest,
    FileVersionResponse,
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

    # Get public URL
    url = await minio_client.get_presigned_url(storage_path)

    # Update user's photo_url
    current_user.photo_url = url
    db.commit()
    db.refresh(current_user)

    return {"url": url, "filename": filename}


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
    """Check if a user can access a file based on privacy settings"""
    # Project leader can always access all files
    project = db.query(Project).filter(Project.id == file_node.project_id).first()
    if project and project.owner_id == user.id:
        return True

    # Owner can always access their own files
    if file_node.owner_id == user.id:
        return True

    # Check privacy level
    if file_node.privacy == PrivacyLevel.PROJECT:
        # All project members can access
        return True
    elif file_node.privacy == PrivacyLevel.PRIVATE:
        # Only owner can access (already checked above)
        return False
    elif file_node.privacy == PrivacyLevel.SHARED:
        # Check if user is in shared_with list
        if file_node.shared_with and user.id in file_node.shared_with:
            return True
        return False
    elif file_node.privacy == PrivacyLevel.PUBLIC:
        return True

    return False


# =============================================================================
# RESPONSE MODELS
# =============================================================================


# Response model for Time Machine
class FileWithVersionsResponse(BaseModel):
    """File with all its versions for Time Machine view"""

    id: str
    name: str
    type: str
    mime_type: str | None
    size: str | None
    deleted: bool = False
    current_version: int
    created_at: datetime
    updated_at: datetime
    category: str  # computed from mime_type
    versions: list[FileVersionResponse]

    class Config:
        from_attributes = True


class TimeMachineResponse(BaseModel):
    """Project files grouped by category with versions"""

    project_id: str
    total_files: int
    total_versions: int
    categories: dict[str, list[FileWithVersionsResponse]]


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


@router.get("/project/{project_id}/time-machine", response_model=TimeMachineResponse)
async def get_project_time_machine(
    project_id: str,
    category: str | None = Query(default=None, description="Filter by category"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get all files in a project with their version history, grouped by category.
    This is the Time Machine view for versioning and merge conflict management.

    Categories: documents, spreadsheets, images, videos, audio, 3d_models, archives, code, other
    """
    check_project_permission(project_id, current_user, db)

    # Get all files (not folders) in the project with their versions
    query = (
        db.query(FileNode)
        .filter(
            FileNode.project_id == project_id, FileNode.type == FileNodeType.FILE
        )
        .options(joinedload(FileNode.versions))
    )

    files = query.all()

    # Group files by category
    categories: dict[str, list[Any]] = defaultdict(list)
    total_versions = 0

    for file in files:
        file_category = get_file_category(file.mime_type, file.name)

        # Filter by category if specified
        if category and file_category != category:
            continue

        # Sort versions by version number descending
        versions = sorted(file.versions, key=lambda v: v.version, reverse=True)
        total_versions += len(versions) + 1  # +1 for current version

        file_data = FileWithVersionsResponse(
            id=file.id,
            name=file.name,
            type=file.type.value,
            mime_type=file.mime_type,
            size=file.size,
            current_version=file.version,
            created_at=file.created_at,
            updated_at=file.updated_at,
            category=file_category,
            versions=[
                FileVersionResponse(
                    id=v.id,
                    file_node_id=v.file_node_id,
                    version=v.version,
                    storage_path=v.storage_path,
                    size=v.size,
                    checksum=v.checksum,
                    created_at=v.created_at,
                    created_by=v.created_by,
                )
                for v in versions
            ],
        )
        categories[file_category].append(file_data)

    return TimeMachineResponse(
        project_id=project_id,
        total_files=len(files)
        if not category
        else sum(len(cats) for cats in categories.values()),
        total_versions=total_versions,
        categories=dict(categories),
    )


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
    """
    Create a personal "My Folder" for the current user in a project.

    - Only researchers and project leaders can create their own personal folder
    - The folder is automatically set to PRIVATE privacy
    - Only one "My Folder" can exist per user per project
    - The folder is owned by the creating user
    """
    from app.models import UserRole, project_members

    check_project_permission(project_id, current_user, db)

    # Get project to check permissions
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Check if user is researcher or owner (not a guest)
    is_owner = project.owner_id == current_user.id
    member_role = None

    if not is_owner:
        # Check member role
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
            detail="Guests cannot create personal folders. Only researchers and project leaders can create a My Folder.",
        )

    # Ensure the /users folder exists
    users_folder = await ensure_users_folder(project_id, db)

    # Check if user already has a folder in /users (by owner_id)
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

    # Create the personal folder inside /users
    # Use user ID as folder name (prevents issues with username changes)
    # Frontend will display as username
    folder_name = current_user.id

    my_folder = FileNode(
        project_id=project_id,
        parent_id=users_folder.id,  # Inside /users folder
        name=folder_name,
        type=FileNodeType.FOLDER,
        owner_id=current_user.id,
        privacy=PrivacyLevel.PRIVATE,  # Private by default
        is_locked=False,  # Can be renamed/deleted by owner
    )

    db.add(my_folder)
    db.commit()
    db.refresh(my_folder)

    await log_activity(
        db=db,
        project_id=project_id,
        activity_type="FOLDER_CREATED",
        description=f'Created personal folder "{folder_name}"',
        user_id=current_user.id,
        metadata={
            "folder_id": my_folder.id,
            "folder_name": folder_name,
            "is_personal": True,
        },
    )

    await emit_content_update(project_id, "files")

    return my_folder


# Request model for folder permission settings
class FolderPermissionSettings(BaseModel):
    default_can_view: bool = True
    default_can_edit: bool = False
    member_permissions: list[dict[str, Any]] = []  # [{user_id, can_view, can_edit}]


@router.put("/project/{project_id}/my-folder/permissions")
async def update_my_folder_permissions(
    project_id: str,
    settings: FolderPermissionSettings,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update permissions for the user's personal folder"""
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
        raise HTTPException(status_code=404, detail="Personal folder not found")

    # Find the user's personal folder inside /users
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

    if not my_folder:
        raise HTTPException(status_code=404, detail="Personal folder not found")

    # Build the shared_with list based on permissions
    shared_with = []
    for perm in settings.member_permissions:
        if perm.get("can_view", False):
            shared_with.append(perm["user_id"])

    # Update the folder's privacy and shared_with
    if not settings.default_can_view and len(shared_with) == 0:
        my_folder.privacy = PrivacyLevel.PRIVATE
    elif settings.default_can_view:
        # If default is view-enabled, set to PROJECT level (all can view)
        my_folder.privacy = PrivacyLevel.PROJECT
    else:
        # Some specific users have access
        my_folder.privacy = PrivacyLevel.SHARED

    my_folder.shared_with = shared_with if shared_with else None

    # Store extended permissions as metadata in the folder
    # This includes edit permissions which we need to check separately
    my_folder.metadata = {
        "folder_permissions": {
            "default_can_view": settings.default_can_view,
            "default_can_edit": settings.default_can_edit,
            "member_permissions": settings.member_permissions,
        }
    }

    db.commit()
    db.refresh(my_folder)

    await emit_content_update(project_id, "files")

    return {"message": "Folder permissions updated", "folder_id": my_folder.id}


@router.get("/project/{project_id}/my-folder/permissions")
async def get_my_folder_permissions(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get current permission settings for the user's personal folder"""
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
        # Return default settings - no users folder means no personal folders
        return {
            "folder_id": None,
            "default_can_view": True,
            "default_can_edit": False,
            "member_permissions": [],
        }

    # Find the user's personal folder inside /users
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

    if not my_folder:
        # Return default settings
        return {
            "folder_id": None,
            "default_can_view": True,
            "default_can_edit": False,
            "member_permissions": [],
        }

    # Get stored permissions from metadata
    if my_folder.metadata and "folder_permissions" in my_folder.metadata:
        perms = my_folder.metadata["folder_permissions"]
        return {"folder_id": my_folder.id, **perms}

    # Return defaults based on privacy level
    return {
        "folder_id": my_folder.id,
        "default_can_view": my_folder.privacy != PrivacyLevel.PRIVATE,
        "default_can_edit": False,
        "member_permissions": [
            {"user_id": uid, "can_view": True, "can_edit": False}
            for uid in (my_folder.shared_with or [])
        ],
    }


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
        privacy=PrivacyLevel.PROJECT,  # Default to project visibility
    )
    db.add(node)
    db.commit()
    db.refresh(node)

    # Log activity
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

    # Notify all users in project that files have been updated (file uploaded)
    await emit_content_update(project_id, "files")

    return node


@router.get("/{node_id}/download")
async def download_file(
    node_id: str,
    current_user: User = Depends(get_current_user_or_token),
    db: Session = Depends(get_db),
):
    """Download a file node's content.

    Accepts authentication via Authorization header OR token query parameter.
    Returns a streaming response with appropriate Content-Type and Content-Disposition.
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

    # Stream file from MinIO to avoid loading entire content in memory for large files
    try:
        # Get object to stream and its stat for size
        stat = minio_client.client.stat_object(
            minio_client.bucket_name, node.storage_path
        )
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

    filename = node.name or "download"
    media_type = node.mime_type or "application/octet-stream"

    # Build headers - only include Content-Length if we have a valid size
    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
    }
    file_size = getattr(stat, "size", None)
    if file_size is not None and file_size > 0:
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

    # Read new content
    data = await new_file.read()

    # Save current version to history before overwriting
    if node.storage_path and node.version >= 1:
        old_version = FileVersion(
            file_node_id=node.id,
            version=node.version,
            storage_path=node.storage_path,
            size=node.size,
            checksum=node.checksum,
            created_by=current_user.id,
        )
        db.add(old_version)

    # Generate new storage path to keep old version intact
    new_storage_path = f"files/{node.project_id}/{uuid.uuid4()}"

    # Upload new content
    await minio_client.upload_file(
        data,
        new_storage_path,
        new_file.content_type or node.mime_type or "application/octet-stream",
    )

    # Calculate new checksum
    new_checksum = hashlib.md5(data).hexdigest()

    # Update metadata
    node.storage_path = new_storage_path
    node.mime_type = new_file.content_type or node.mime_type
    node.size = str(len(data))
    node.checksum = new_checksum
    node.version = node.version + 1
    node.updated_at = datetime.utcnow()

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
# PRIVACY & SHARING ENDPOINTS
# =============================================================================


@router.put("/{node_id}/privacy", response_model=FileNodeBase)
async def update_file_privacy(
    node_id: str,
    privacy_update: FilePrivacyUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update privacy settings for a file or folder"""
    node = db.query(FileNode).filter(FileNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    check_project_permission(node.project_id, current_user, db)

    # Only owner or project leader can change privacy
    project = db.query(Project).filter(Project.id == node.project_id).first()
    if node.owner_id != current_user.id and project.owner_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Only file owner or project leader can change privacy",
        )

    node.privacy = PrivacyLevel(privacy_update.privacy.value)
    node.shared_with = privacy_update.shared_with
    node.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(node)

    await log_activity(
        db=db,
        project_id=node.project_id,
        activity_type="FILE_UPDATED",
        description=f'Updated privacy for "{node.name}" to {privacy_update.privacy.value}',
        user_id=current_user.id,
        metadata={"node_id": node.id, "privacy": privacy_update.privacy.value},
    )

    return node


@router.get("/{node_id}/versions", response_model=list[FileVersionResponse])
async def get_file_versions(
    node_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get version history for a file"""
    node = db.query(FileNode).filter(FileNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    check_project_permission(node.project_id, current_user, db)

    if not can_access_file(node, current_user, db):
        raise HTTPException(status_code=403, detail="Access denied")

    versions = (
        db.query(FileVersion)
        .filter(FileVersion.file_node_id == node_id)
        .order_by(FileVersion.version.desc())
        .all()
    )
    return versions


@router.get("/{node_id}/version/{version}/download")
async def download_file_version(
    node_id: str,
    version: int,
    current_user: User = Depends(get_current_user_or_token),
    db: Session = Depends(get_db),
):
    """Download a specific version of a file.

    Accepts authentication via Authorization header OR token query parameter.
    """
    node = db.query(FileNode).filter(FileNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    check_project_permission(node.project_id, current_user, db)

    if not can_access_file(node, current_user, db):
        raise HTTPException(status_code=403, detail="Access denied")

    file_version = (
        db.query(FileVersion)
        .filter(FileVersion.file_node_id == node_id, FileVersion.version == version)
        .first()
    )

    if not file_version:
        raise HTTPException(status_code=404, detail="Version not found")

    try:
        stat = minio_client.client.stat_object(
            minio_client.bucket_name, file_version.storage_path
        )
        obj = minio_client.client.get_object(
            minio_client.bucket_name, file_version.storage_path
        )
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to retrieve version")

    def iterfile():
        try:
            for data in obj.stream(32 * 1024):
                yield data
        finally:
            obj.close()
            obj.release_conn()

    filename = f"{node.name}.v{version}"
    media_type = node.mime_type or "application/octet-stream"
    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Content-Length": str(getattr(stat, "size", "") or ""),
    }
    return StreamingResponse(iterfile(), media_type=media_type, headers=headers)


@router.post("/{node_id}/restore/{version}", response_model=FileNodeBase)
async def restore_file_version(
    node_id: str,
    version: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Restore a file to a previous version"""
    node = db.query(FileNode).filter(FileNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    check_project_permission(node.project_id, current_user, db)

    if node.is_locked:
        raise HTTPException(status_code=400, detail="This file cannot be modified")

    if node.owner_id != current_user.id:
        project = db.query(Project).filter(Project.id == node.project_id).first()
        if project.owner_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="Only file owner or project leader can restore versions",
            )

    file_version = (
        db.query(FileVersion)
        .filter(FileVersion.file_node_id == node_id, FileVersion.version == version)
        .first()
    )

    if not file_version:
        raise HTTPException(status_code=404, detail="Version not found")

    # Create a new version from current state before restoring
    current_version = FileVersion(
        file_node_id=node.id,
        version=node.version,
        storage_path=node.storage_path,
        size=node.size,
        checksum=node.checksum,
        created_by=current_user.id,
    )
    db.add(current_version)

    # Update node to point to old version's content
    node.storage_path = file_version.storage_path
    node.size = file_version.size
    node.checksum = file_version.checksum
    node.version = node.version + 1
    node.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(node)

    await log_activity(
        db=db,
        project_id=node.project_id,
        activity_type="FILE_UPDATED",
        description=f'Restored "{node.name}" to version {version}',
        user_id=current_user.id,
        metadata={"node_id": node.id, "restored_version": version},
    )

    await emit_content_update(node.project_id, "files")

    return node


# =============================================================================
# USERS FOLDER SYSTEM
# =============================================================================


async def ensure_users_folder(project_id: str, db: Session) -> FileNode:
    """Ensure the 'users' folder exists in project root, create if not"""
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
        users_folder = FileNode(
            project_id=project_id,
            parent_id=None,
            name="users",
            type=FileNodeType.FOLDER,
            is_locked=True,
            privacy=PrivacyLevel.PROJECT,
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
    """Get all files shared with the current user"""
    check_project_permission(project_id, current_user, db)

    # Get files where user is in shared_with list and privacy is SHARED
    # PostgreSQL JSON containment operator

    files = (
        db.query(FileNode)
        .filter(
            FileNode.project_id == project_id,
            FileNode.privacy == PrivacyLevel.SHARED,
            FileNode.owner_id != current_user.id,
            FileNode.shared_with.contains([current_user.id]),
        )
        .all()
    )

    return files


@router.get("/project/{project_id}/shared-by-me", response_model=list[FileNodeBase])
async def get_files_shared_by_me(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all files the current user has shared with others"""
    check_project_permission(project_id, current_user, db)

    files = (
        db.query(FileNode)
        .filter(
            FileNode.project_id == project_id,
            FileNode.owner_id == current_user.id,
            FileNode.privacy == PrivacyLevel.SHARED,
        )
        .all()
    )

    return files


@router.get("/project/{project_id}/users-folder", response_model=list[FileNodeBase])
async def list_users_folder(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List contents of users folder with privacy filtering"""
    check_project_permission(project_id, current_user, db)
    project = db.query(Project).filter(Project.id == project_id).first()

    users_folder = await ensure_users_folder(project_id, db)

    # Get all user folders
    user_folders = (
        db.query(FileNode)
        .filter(
            FileNode.parent_id == users_folder.id,
            FileNode.type == FileNodeType.FOLDER,
        )
        .all()
    )

    # Project leader can see all folders
    if project.owner_id == current_user.id:
        return user_folders

    # Regular users can only see their own folder
    visible_folders = [f for f in user_folders if f.owner_id == current_user.id]
    return visible_folders


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

