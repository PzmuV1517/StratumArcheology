from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.dependencies import get_current_user, get_current_user_or_token, check_project_permission
from app.models import User, Project, FileNode, FileNodeType, Note, NoteFileLink, FileVersion, PrivacyLevel
from app.schemas import (
    FileNodeBase, FileNodeCreateFolder, FileNodeMoveRequest, FileNodeRenameRequest,
    FilePrivacyUpdateRequest, FileVersionResponse, PrivacyLevel as PrivacyLevelSchema
)
from app.minio_client import minio_client
from app.websocket import emit_content_update, log_activity
from datetime import datetime
import uuid
import hashlib

router = APIRouter(prefix="/files", tags=["files"])


@router.get("/project/{project_id}", response_model=List[FileNodeBase])
async def list_project_root(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List root-level file nodes for a project"""
    check_project_permission(project_id, current_user, db)
    nodes = db.query(FileNode).filter(FileNode.project_id == project_id, FileNode.parent_id == None).order_by(FileNode.type.desc(), FileNode.name.asc()).all()
    return nodes


@router.get("/{node_id}/children", response_model=List[FileNodeBase])
async def list_children(
    node_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    node = db.query(FileNode).filter(FileNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Folder not found")
    check_project_permission(node.project_id, current_user, db)
    children = db.query(FileNode).filter(FileNode.parent_id == node_id).order_by(FileNode.type.desc(), FileNode.name.asc()).all()
    return children


@router.post("/project/{project_id}/folders", response_model=FileNodeBase, status_code=status.HTTP_201_CREATED)
async def create_folder(
    project_id: str,
    folder: FileNodeCreateFolder,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_project_permission(project_id, current_user, db)
    parent = None
    if folder.parent_id:
        parent = db.query(FileNode).filter(FileNode.id == folder.parent_id, FileNode.project_id == project_id).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent folder not found")
        if parent.type != FileNodeType.FOLDER:
            raise HTTPException(status_code=400, detail="Parent must be a folder")

    node = FileNode(
        project_id=project_id,
        parent_id=folder.parent_id,
        name=folder.name,
        type=FileNodeType.FOLDER,
    )
    db.add(node)
    db.commit()
    db.refresh(node)
    
    # Log activity
    await log_activity(
        db=db,
        project_id=project_id,
        activity_type='FOLDER_CREATED',
        description=f'Created folder "{node.name}"',
        user_id=current_user.id,
        metadata={'folder_id': node.id, 'folder_name': node.name}
    )
    
    # Notify all users in project that files have been updated (folder created)
    await emit_content_update(project_id, 'files')
    
    return node


@router.put("/{node_id}/move", response_model=FileNodeBase)
async def move_node(
    node_id: str,
    move: FileNodeMoveRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    node = db.query(FileNode).filter(FileNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    check_project_permission(node.project_id, current_user, db)
    if node.is_locked:
        raise HTTPException(status_code=400, detail="This node cannot be moved")

    new_parent = None
    if move.new_parent_id:
        new_parent = db.query(FileNode).filter(FileNode.id == move.new_parent_id, FileNode.project_id == node.project_id).first()
        if not new_parent:
            raise HTTPException(status_code=404, detail="New parent not found")
        if new_parent.type != FileNodeType.FOLDER:
            raise HTTPException(status_code=400, detail="New parent must be a folder")

    node.parent_id = move.new_parent_id
    node.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(node)
    
    # Log activity
    await log_activity(
        db=db,
        project_id=node.project_id,
        activity_type='FILE_MOVED',
        description=f'Moved "{node.name}"',
        user_id=current_user.id,
        metadata={'node_id': node.id, 'node_name': node.name}
    )
    
    # Notify all users in project that files have been updated (file/folder moved)
    await emit_content_update(node.project_id, 'files')
    
    return node


@router.put("/{node_id}/rename", response_model=FileNodeBase)
async def rename_node(
    node_id: str,
    payload: FileNodeRenameRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
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
        if '.' in node.name and not node.name.startswith('.'):
            *base_parts, ext = node.name.rsplit('.', 1)
            old_ext = ext
        else:
            old_ext = None
        # Extract new base (strip any extension user might have typed to avoid changing type)
        new_base = payload.name
        if '.' in new_base and not new_base.startswith('.'):
            new_base = new_base.rsplit('.', 1)[0]
        node.name = f"{new_base}.{old_ext}" if old_ext else new_base
    else:
        node.name = payload.name
    
    # If this is a file in the Notes folder, sync the note title
    if node.parent_id:
        parent = db.query(FileNode).filter(FileNode.id == node.parent_id).first()
        if parent and parent.name == "Notes" and node.type == FileNodeType.FILE:
            # This is a file in the Notes folder, check if it's linked to a note
            note_link = db.query(NoteFileLink).filter(NoteFileLink.file_node_id == node.id).first()
            if note_link and note_link.note:
                # Update the note title from the filename
                if node.name.endswith('.txt'):
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
        activity_type='FILE_RENAMED',
        description=f'Renamed to "{node.name}"',
        user_id=current_user.id,
        metadata={'node_id': node.id, 'new_name': node.name}
    )
    
    # Notify all users in project that files have been updated (file/folder renamed)
    await emit_content_update(node.project_id, 'files')
    
    return node


@router.delete("/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_node(
    node_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
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
        activity_type='FILE_DELETED' if node_type == FileNodeType.FILE else 'FOLDER_DELETED',
        description=f'Deleted {"file" if node_type == FileNodeType.FILE else "folder"} "{node_name}"',
        user_id=current_user.id,
        metadata={'node_name': node_name}
    )
    
    # Notify all users in project that files have been updated (file/folder deleted)
    await emit_content_update(project_id, 'files')
    
    return None


@router.post("/project/{project_id}/upload", response_model=FileNodeBase, status_code=status.HTTP_201_CREATED)
async def upload_file(
    project_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_project_permission(project_id, current_user, db)
    
    # Parse form manually to be more tolerant
    form = await request.form()
    print(f"DEBUG: Received form keys: {list(form.keys())}")
    
    parent_id = form.get('parent_id')
    file = None
    
    # Find the file in the form
    for key, value in form.items():
        print(f"DEBUG: Form field '{key}' type: {type(value)}, value preview: {str(value)[:100] if not isinstance(value, UploadFile) else 'UploadFile'}")
        if hasattr(value, 'file'):  # UploadFile check
            file = value
            print(f"DEBUG: Found file in field '{key}': {file.filename}, content_type: {file.content_type}")
            break
    
    if file is None:
        raise HTTPException(status_code=422, detail=f"No file uploaded. Received keys: {list(form.keys())}")
    
    parent = None
    if parent_id:
        parent = db.query(FileNode).filter(FileNode.id == parent_id, FileNode.project_id == project_id).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent folder not found")
        if parent.type != FileNodeType.FOLDER:
            raise HTTPException(status_code=400, detail="Parent must be a folder")

    data = await file.read()
    object_name = f"files/{project_id}/{uuid.uuid4()}"
    await minio_client.upload_file(data, object_name, file.content_type)
    
    # Calculate checksum for integrity checking
    file_checksum = hashlib.md5(data).hexdigest()

    node = FileNode(
        project_id=project_id,
        parent_id=parent_id,
        name=file.filename or "file",
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
        activity_type='FILE_UPLOADED',
        description=f'Uploaded file "{node.name}"',
        user_id=current_user.id,
        metadata={'file_id': node.id, 'file_name': node.name, 'file_size': node.size}
    )
    
    # Notify all users in project that files have been updated (file uploaded)
    await emit_content_update(project_id, 'files')
    
    return node


@router.get("/{node_id}/download")
async def download_file(
    node_id: str,
    current_user: User = Depends(get_current_user_or_token),
    db: Session = Depends(get_db)
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
        raise HTTPException(status_code=400, detail="Only file nodes can be downloaded")
    check_project_permission(node.project_id, current_user, db)
    if not node.storage_path:
        raise HTTPException(status_code=404, detail="Stored object missing")

    # Stream file from MinIO to avoid loading entire content in memory for large files
    try:
        # Get object to stream and its stat for size
        stat = minio_client.client.stat_object(minio_client.bucket_name, node.storage_path)
        obj = minio_client.client.get_object(minio_client.bucket_name, node.storage_path)
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
    headers = {
        "Content-Disposition": f"attachment; filename=\"{filename}\"",
        "Content-Length": str(getattr(stat, 'size', '') or '')
    }
    return StreamingResponse(iterfile(), media_type=media_type, headers=headers)


@router.put("/{node_id}/content", response_model=FileNodeBase)
async def replace_file_content(
    node_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Replace the bytes of a file node while preserving its name and extension.

    Accepts multipart/form-data with a 'file' field. Updates mime_type and size. Denies locked nodes.
    """
    node = db.query(FileNode).filter(FileNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    if node.type != FileNodeType.FILE:
        raise HTTPException(status_code=400, detail="Only file nodes can be replaced")
    check_project_permission(node.project_id, current_user, db)
    if node.is_locked:
        raise HTTPException(status_code=400, detail="This node cannot be modified")

    form = await request.form()
    new_file = None
    for key, value in form.items():
        if hasattr(value, 'file'):
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
            created_by=current_user.id
        )
        db.add(old_version)
    
    # Generate new storage path to keep old version intact
    new_storage_path = f"files/{node.project_id}/{uuid.uuid4()}"
    
    # Upload new content
    await minio_client.upload_file(data, new_storage_path, new_file.content_type or node.mime_type or "application/octet-stream")
    
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
            note_link = db.query(NoteFileLink).filter(NoteFileLink.file_node_id == node.id).first()
            if note_link and note_link.note:
                # Update the note content from the file
                try:
                    note_link.note.content = data.decode('utf-8')
                    filename = node.name
                    if filename.endswith('.txt'):
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
    await emit_content_update(node.project_id, 'files')
    
    return node


# =============================================================================
# PRIVACY & SHARING ENDPOINTS
# =============================================================================

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


@router.put("/{node_id}/privacy", response_model=FileNodeBase)
async def update_file_privacy(
    node_id: str,
    privacy_update: FilePrivacyUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update privacy settings for a file or folder"""
    node = db.query(FileNode).filter(FileNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    
    check_project_permission(node.project_id, current_user, db)
    
    # Only owner or project leader can change privacy
    project = db.query(Project).filter(Project.id == node.project_id).first()
    if node.owner_id != current_user.id and project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only file owner or project leader can change privacy")
    
    node.privacy = PrivacyLevel(privacy_update.privacy.value)
    node.shared_with = privacy_update.shared_with
    node.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(node)
    
    await log_activity(
        db=db,
        project_id=node.project_id,
        activity_type='FILE_UPDATED',
        description=f'Updated privacy for "{node.name}" to {privacy_update.privacy.value}',
        user_id=current_user.id,
        metadata={'node_id': node.id, 'privacy': privacy_update.privacy.value}
    )
    
    return node


@router.get("/{node_id}/versions", response_model=List[FileVersionResponse])
async def get_file_versions(
    node_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get version history for a file"""
    node = db.query(FileNode).filter(FileNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    
    check_project_permission(node.project_id, current_user, db)
    
    if not can_access_file(node, current_user, db):
        raise HTTPException(status_code=403, detail="Access denied")
    
    versions = db.query(FileVersion).filter(FileVersion.file_node_id == node_id).order_by(FileVersion.version.desc()).all()
    return versions


@router.get("/{node_id}/version/{version}/download")
async def download_file_version(
    node_id: str,
    version: int,
    current_user: User = Depends(get_current_user_or_token),
    db: Session = Depends(get_db)
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
    
    file_version = db.query(FileVersion).filter(
        FileVersion.file_node_id == node_id,
        FileVersion.version == version
    ).first()
    
    if not file_version:
        raise HTTPException(status_code=404, detail="Version not found")
    
    try:
        stat = minio_client.client.stat_object(minio_client.bucket_name, file_version.storage_path)
        obj = minio_client.client.get_object(minio_client.bucket_name, file_version.storage_path)
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
        "Content-Disposition": f"attachment; filename=\"{filename}\"",
        "Content-Length": str(getattr(stat, 'size', '') or '')
    }
    return StreamingResponse(iterfile(), media_type=media_type, headers=headers)


@router.post("/{node_id}/restore/{version}", response_model=FileNodeBase)
async def restore_file_version(
    node_id: str,
    version: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
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
            raise HTTPException(status_code=403, detail="Only file owner or project leader can restore versions")
    
    file_version = db.query(FileVersion).filter(
        FileVersion.file_node_id == node_id,
        FileVersion.version == version
    ).first()
    
    if not file_version:
        raise HTTPException(status_code=404, detail="Version not found")
    
    # Create a new version from current state before restoring
    current_version = FileVersion(
        file_node_id=node.id,
        version=node.version,
        storage_path=node.storage_path,
        size=node.size,
        checksum=node.checksum,
        created_by=current_user.id
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
        activity_type='FILE_UPDATED',
        description=f'Restored "{node.name}" to version {version}',
        user_id=current_user.id,
        metadata={'node_id': node.id, 'restored_version': version}
    )
    
    await emit_content_update(node.project_id, 'files')
    
    return node


# =============================================================================
# USERS FOLDER SYSTEM
# =============================================================================

async def ensure_users_folder(project_id: str, db: Session) -> FileNode:
    """Ensure the 'users' folder exists in project root, create if not"""
    users_folder = db.query(FileNode).filter(
        FileNode.project_id == project_id,
        FileNode.parent_id == None,
        FileNode.name == "users",
        FileNode.type == FileNodeType.FOLDER
    ).first()
    
    if not users_folder:
        users_folder = FileNode(
            project_id=project_id,
            parent_id=None,
            name="users",
            type=FileNodeType.FOLDER,
            is_locked=True,
            privacy=PrivacyLevel.PROJECT
        )
        db.add(users_folder)
        db.commit()
        db.refresh(users_folder)
    
    return users_folder


async def ensure_user_folder(project_id: str, user: User, db: Session) -> FileNode:
    """Ensure a user's personal folder exists within the users folder"""
    users_folder = await ensure_users_folder(project_id, db)
    
    # Use display_name or email username as folder name
    folder_name = user.display_name or user.email.split('@')[0]
    
    user_folder = db.query(FileNode).filter(
        FileNode.project_id == project_id,
        FileNode.parent_id == users_folder.id,
        FileNode.owner_id == user.id,
        FileNode.type == FileNodeType.FOLDER
    ).first()
    
    if not user_folder:
        user_folder = FileNode(
            project_id=project_id,
            parent_id=users_folder.id,
            name=folder_name,
            type=FileNodeType.FOLDER,
            owner_id=user.id,
            privacy=PrivacyLevel.PRIVATE,
            is_locked=True
        )
        db.add(user_folder)
        db.commit()
        db.refresh(user_folder)
    
    return user_folder


@router.get("/project/{project_id}/my-folder", response_model=FileNodeBase)
async def get_my_folder(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get or create the current user's personal folder"""
    check_project_permission(project_id, current_user, db)
    user_folder = await ensure_user_folder(project_id, current_user, db)
    return user_folder


@router.get("/project/{project_id}/shared-with-me", response_model=List[FileNodeBase])
async def get_files_shared_with_me(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all files shared with the current user"""
    check_project_permission(project_id, current_user, db)
    
    # Get files where user is in shared_with list and privacy is SHARED
    # PostgreSQL JSON containment operator
    from sqlalchemy import cast, String
    from sqlalchemy.dialects.postgresql import JSONB
    
    files = db.query(FileNode).filter(
        FileNode.project_id == project_id,
        FileNode.privacy == PrivacyLevel.SHARED,
        FileNode.owner_id != current_user.id,
        FileNode.shared_with.contains([current_user.id])
    ).all()
    
    return files


@router.get("/project/{project_id}/shared-by-me", response_model=List[FileNodeBase])
async def get_files_shared_by_me(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all files the current user has shared with others"""
    check_project_permission(project_id, current_user, db)
    
    files = db.query(FileNode).filter(
        FileNode.project_id == project_id,
        FileNode.owner_id == current_user.id,
        FileNode.privacy == PrivacyLevel.SHARED
    ).all()
    
    return files


@router.get("/project/{project_id}/users-folder", response_model=List[FileNodeBase])
async def list_users_folder(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List contents of users folder with privacy filtering"""
    check_project_permission(project_id, current_user, db)
    project = db.query(Project).filter(Project.id == project_id).first()
    
    users_folder = await ensure_users_folder(project_id, db)
    
    # Get all user folders
    user_folders = db.query(FileNode).filter(
        FileNode.parent_id == users_folder.id,
        FileNode.type == FileNodeType.FOLDER
    ).all()
    
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
    db: Session = Depends(get_db)
):
    """Get file info including version and privacy"""
    node = db.query(FileNode).filter(FileNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    
    check_project_permission(node.project_id, current_user, db)
    
    if not can_access_file(node, current_user, db):
        raise HTTPException(status_code=403, detail="Access denied")
    
    return node


@router.get("/project/{project_id}/files-info", response_model=List[FileNodeBase])
async def get_files_info_batch(
    project_id: str,
    node_ids: str,  # Comma-separated list of node IDs
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get info for multiple files at once (for offline sync)"""
    check_project_permission(project_id, current_user, db)
    
    ids = [id.strip() for id in node_ids.split(',') if id.strip()]
    if not ids:
        return []
    
    nodes = db.query(FileNode).filter(
        FileNode.id.in_(ids),
        FileNode.project_id == project_id
    ).all()
    
    # Filter by access
    accessible_nodes = [n for n in nodes if can_access_file(n, current_user, db)]
    
    return accessible_nodes