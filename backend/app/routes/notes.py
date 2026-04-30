"""
Note management API routes.

Handles CRUD operations for project notes, note-to-file synchronization,
note attachments (photos, audio), and content streaming with HTTP Range
support for mobile clients.

STRATUM - Proprietary and Confidential
Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
All rights reserved.
No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
"""

import uuid
from datetime import datetime

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Body,
    Depends,
    File,
    HTTPException,
    Request,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import check_project_permission, get_current_user
from app.history import record_create, record_note_content, record_snapshot
from app.minio_client import minio_client
from app.models import (
    FileNode,
    FileNodeType,
    Note,
    NoteAttachment,
    NoteFileLink,
    SnapshotKind,
    SnapshotReason,
    User,
)
from app.permissions import PermissionMode, assert_perm, can_read, resolve_permission
from app.config import settings
from app.schemas import NoteCreate, NoteResponse, NoteUpdate
from app.transcription import transcribe_note_audio
from app.websocket import emit_content_update, log_activity

router = APIRouter(prefix="/notes", tags=["notes"])


@router.post("/", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
@router.post(
    "", response_model=NoteResponse, status_code=status.HTTP_201_CREATED
)  # accept no-trailing-slash to avoid CORS redirect
async def create_note(
    note_data: NoteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new note in a project"""
    check_project_permission(note_data.project_id, current_user, db)

    # Create base note
    note = Note(
        title=note_data.title,
        content=note_data.content or "",
        project_id=note_data.project_id,
        author_id=current_user.id,
    )
    db.add(note)
    db.commit()
    db.refresh(note)

    if file_node is not None:
        setattr(note, "file_node_id", file_node.id)

    # Resolve the target folder. Notes default to the project "Notes" folder
    # unless the caller provided a parent_id (e.g. saving into My Folder).
    target_folder: FileNode | None = None
    if getattr(note_data, "parent_id", None):
        target_folder = (
            db.query(FileNode)
            .filter(
                FileNode.id == note_data.parent_id,
                FileNode.project_id == note.project_id,
            )
            .first()
        )
        if not target_folder:
            raise HTTPException(status_code=404, detail="Parent folder not found")
        if target_folder.type != FileNodeType.FOLDER:
            raise HTTPException(status_code=400, detail="Parent must be a folder")
        assert_perm(db, target_folder, current_user, PermissionMode.WRITE)
    else:
        # Ensure "Notes" folder exists at project root.
        target_folder = (
            db.query(FileNode)
            .filter(
                FileNode.project_id == note.project_id,
                FileNode.parent_id == None,
                FileNode.name == "Notes",
                FileNode.type == FileNodeType.FOLDER,
            )
            .first()
        )
        if not target_folder:
            target_folder = FileNode(
                project_id=note.project_id,
                parent_id=None,
                name="Notes",
                type=FileNodeType.FOLDER,
            )
            db.add(target_folder)
            db.commit()
            db.refresh(target_folder)

    # Build a unique filename based on the note title.
    base_name = f"{note.title}.txt"
    candidate = base_name
    counter = 1
    while (
        db.query(FileNode)
        .filter(
            FileNode.project_id == note.project_id,
            FileNode.parent_id == target_folder.id,
            FileNode.name == candidate,
        )
        .first()
    ):
        candidate = f"{note.title} ({counter}).txt"
        counter += 1

    # Keep the note title aligned with the deduped filename.
    if candidate != base_name and candidate.endswith(".txt"):
        note.title = candidate[:-4]

    content_bytes = (note.content or "").encode("utf-8")
    storage_path = f"notes/{note.project_id}/{note.id}.txt"
    await minio_client.upload_file(content_bytes, storage_path, "text/plain")

    note_node = FileNode(
        project_id=note.project_id,
        parent_id=target_folder.id,
        name=candidate,
        type=FileNodeType.FILE,
        storage_path=storage_path,
        mime_type="text/plain",
        size=str(len(content_bytes)),
        owner_id=current_user.id,
    )
    db.add(note_node)
    db.flush()
    note_node.acl_root_id = target_folder.acl_root_id
    db.flush()

    record_create(
        db,
        node=note_node,
        actor_id=current_user.id,
        summary=f'Created note "{note.title}"',
    )
    record_note_content(
        db,
        node=note_node,
        title=note.title,
        content=note.content or "",
        actor_id=current_user.id,
        reason=SnapshotReason.CREATE,
        summary=f'Initial content of note "{note.title}"',
    )

    link = NoteFileLink(note_id=note.id, file_node_id=note_node.id)
    db.add(link)
    db.commit()
    db.refresh(note_node)

    # Log activity
    await log_activity(
        db=db,
        project_id=note.project_id,
        activity_type="NOTE_CREATED",
        description=f'Created note "{note.title}"',
        user_id=current_user.id,
        metadata={"note_id": note.id, "note_title": note.title},
    )

    # Notify all users in project that notes have been updated
    await emit_content_update(note.project_id, "notes")

    # Return full ORM object so response_model includes all fields (author_id, timestamps, attachments)
    setattr(note, "file_node_id", note_node.id)
    return note


@router.get("/project/{project_id}", response_model=list[NoteResponse])
async def get_project_notes(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all notes for a project"""
    check_project_permission(project_id, current_user, db)

    notes = (
        db.query(Note)
        .filter(Note.project_id == project_id)
        .order_by(Note.updated_at.desc())
        .all()
    )

    visible: list[Note] = []
    for note in notes:
        file_link = note.file_link
        file_node = file_link.file_node if file_link else None
        if file_node is not None and not can_read(db, file_node, current_user):
            continue
        if file_node is not None:
            setattr(note, "file_node_id", file_node.id)
        # Add presigned URLs to attachments
        for attachment in note.attachments:
            attachment.url = minio_client.get_presigned_url(attachment.file_path)
        visible.append(note)

    return visible


@router.get("/{note_id}", response_model=NoteResponse)
async def get_note(
    note_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a specific note"""
    note = db.query(Note).filter(Note.id == note_id).first()

    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Note not found"
        )

    check_project_permission(note.project_id, current_user, db)

    file_link = note.file_link
    file_node = file_link.file_node if file_link else None
    if file_node is not None:
        assert_perm(db, file_node, current_user, PermissionMode.READ)

    file_link = note.file_link
    file_node = file_link.file_node if file_link else None
    if file_node is not None:
        assert_perm(db, file_node, current_user, PermissionMode.WRITE)
    file_link = note.file_link
    file_node = file_link.file_node if file_link else None
    if file_node is not None:
        assert_perm(db, file_node, current_user, PermissionMode.WRITE)
    file_link = note.file_link
    file_node = file_link.file_node if file_link else None
    if file_node is not None:
        assert_perm(db, file_node, current_user, PermissionMode.WRITE)

    file_link = note.file_link
    file_node = file_link.file_node if file_link else None
    perm = None
    if file_node is not None:
        perm = resolve_permission(db, file_node, current_user)
        if not perm.can_read:
            raise HTTPException(status_code=403, detail="Access denied")
        setattr(note, "file_node_id", file_node.id)

    # Try to sync content from txt file if it exists
    if file_node and file_node.storage_path:
        try:
            file_data = await minio_client.get_file(file_node.storage_path)
            file_content = file_data.decode("utf-8")

            if note.content != file_content:
                if perm and perm.can_write:
                    note.content = file_content
                    note.updated_at = datetime.utcnow()
                    db.commit()
                    db.refresh(note)
                else:
                    note.content = file_content
        except Exception as e:
            print(f"Warning: Could not sync note {note_id} from file: {e}")

    # Add presigned URLs to attachments
    for attachment in note.attachments:
        attachment.url = minio_client.get_presigned_url(attachment.file_path)

    return note


@router.put("/{note_id}", response_model=NoteResponse)
async def update_note(
    note_id: str,
    note_data: NoteUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a note"""
    note = db.query(Note).filter(Note.id == note_id).first()

    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Note not found"
        )

    check_project_permission(note.project_id, current_user, db)

    file_link = note.file_link
    file_node = file_link.file_node if file_link else None
    if file_node is not None:
        assert_perm(db, file_node, current_user, PermissionMode.WRITE)

    # Get the linked file node
    file_link = note.file_link
    file_node = file_link.file_node if file_link else None
    if file_node is not None:
        assert_perm(db, file_node, current_user, PermissionMode.WRITE)

    note_changed = False
    # Update fields
    if note_data.title is not None:
        note.title = note_data.title
        note_changed = True
        # Update filename in file node, keeping it unique within parent
        if file_node:
            base_name = f"{note_data.title}.txt"
            candidate = base_name
            counter = 1
            while (
                db.query(FileNode)
                .filter(
                    FileNode.project_id == note.project_id,
                    FileNode.parent_id == file_node.parent_id,
                    FileNode.name == candidate,
                    FileNode.id != file_node.id,
                )
                .first()
            ):
                candidate = f"{note_data.title} ({counter}).txt"
                counter += 1
            file_node.name = candidate
            if candidate != base_name and candidate.endswith(".txt"):
                note.title = candidate[:-4]
            file_node.updated_at = datetime.utcnow()

    if note_data.content is not None:
        note.content = note_data.content
        note_changed = True
        # Update txt file content in MinIO
        if file_node and file_node.storage_path:
            content_bytes = (note_data.content or "").encode("utf-8")
            await minio_client.upload_file(
                content_bytes, file_node.storage_path, "text/plain"
            )
            file_node.size = str(len(content_bytes))
            file_node.updated_at = datetime.utcnow()
            file_node.version = (file_node.version or 0) + 1

    note.updated_at = datetime.utcnow()

    if note_changed and file_node is not None:
        record_note_content(
            db,
            node=file_node,
            title=note.title,
            content=note.content or "",
            actor_id=current_user.id,
            reason=SnapshotReason.EDIT,
            summary=f'Updated note "{note.title}"',
        )

    db.commit()
    db.refresh(note)

    # Log activity
    await log_activity(
        db=db,
        project_id=note.project_id,
        activity_type="NOTE_UPDATED",
        description=f'Updated note "{note.title}"',
        user_id=current_user.id,
        metadata={"note_id": note.id, "note_title": note.title},
    )

    # Notify all users in project that notes have been updated
    await emit_content_update(note.project_id, "notes")

    return note


@router.post("/{note_id}/sync-from-file", response_model=NoteResponse)
async def sync_note_from_file(
    note_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Sync note content from its associated txt file"""
    note = db.query(Note).filter(Note.id == note_id).first()

    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Note not found"
        )

    check_project_permission(note.project_id, current_user, db)

    # Get the linked file node
    file_link = note.file_link
    if not file_link or not file_link.file_node:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No associated txt file found",
        )
    file_node = file_link.file_node
    assert_perm(db, file_node, current_user, PermissionMode.WRITE)
    if not file_node.storage_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No associated txt file found",
        )

    try:
        # Get content from txt file
        file_data = await minio_client.get_file(file_link.file_node.storage_path)
        file_content = file_data.decode("utf-8")

        # Update note content and title from filename
        note.content = file_content
        filename = file_link.file_node.name
        if filename.endswith(".txt"):
            note.title = filename[:-4]  # Remove .txt extension
        note.updated_at = datetime.utcnow()

        record_note_content(
            db,
            node=file_node,
            title=note.title,
            content=note.content or "",
            actor_id=current_user.id,
            reason=SnapshotReason.EDIT,
            summary=f'Synced note "{note.title}" from file',
        )

        db.commit()
        db.refresh(note)

        setattr(note, "file_node_id", file_node.id)

        return note

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to sync from file: {str(e)}",
        )


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    note_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a note"""
    note = db.query(Note).filter(Note.id == note_id).first()

    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Note not found"
        )

    check_project_permission(note.project_id, current_user, db)
    file_link = note.file_link
    file_node = file_link.file_node if file_link else None
    if file_node is not None:
        assert_perm(db, file_node, current_user, PermissionMode.WRITE)
        record_snapshot(
            db,
            project_id=note.project_id,
            node=file_node,
            kind=SnapshotKind.DELETE,
            reason=SnapshotReason.DELETE,
            actor_id=current_user.id,
            payload={
                "name": file_node.name,
                "type": file_node.type.value,
                "parent_id": file_node.parent_id,
                "owner_id": file_node.owner_id,
                "mime_type": file_node.mime_type,
                "size": file_node.size,
                "storage_path": file_node.storage_path,
                "is_acl_root": file_node.is_acl_root,
                "note": {
                    "id": note.id,
                    "title": note.title,
                    "content": note.content,
                    "author_id": note.author_id,
                    "created_at": note.created_at,
                    "updated_at": note.updated_at,
                    "version": note.version,
                    "transcription": note.transcription,
                    "transcription_original": note.transcription_original,
                    "transcription_modified": note.transcription_modified,
                    "transcription_status": note.transcription_status,
                },
            },
            summary=f'Deleted note "{note.title}"',
        )
        db.delete(file_node)
    else:
        # Fallback for legacy notes without a file mirror
        if note.author_id != current_user.id:
            check_project_permission(
                note.project_id, current_user, db, required_role="leader"
            )

    # Delete attachments and their mirrored FileNodes (keep storage for 7 days)
    for attachment in note.attachments:
        mirrored_node = (
            db.query(FileNode)
            .filter(
                FileNode.project_id == note.project_id,
                FileNode.storage_path == attachment.file_path,
            )
            .first()
        )
        if mirrored_node:
            record_snapshot(
                db,
                project_id=note.project_id,
                node=mirrored_node,
                kind=SnapshotKind.DELETE,
                reason=SnapshotReason.DELETE,
                actor_id=current_user.id,
                payload={
                    "name": mirrored_node.name,
                    "type": mirrored_node.type.value,
                    "parent_id": mirrored_node.parent_id,
                    "owner_id": mirrored_node.owner_id,
                    "mime_type": mirrored_node.mime_type,
                    "size": mirrored_node.size,
                    "storage_path": mirrored_node.storage_path,
                    "is_acl_root": mirrored_node.is_acl_root,
                },
                summary=f'Deleted attachment "{attachment.filename}"',
            )
            db.delete(mirrored_node)

    project_id = note.project_id
    note_title = note.title
    db.delete(note)
    db.commit()

    # Log activity
    await log_activity(
        db=db,
        project_id=project_id,
        activity_type="NOTE_DELETED",
        description=f'Deleted note "{note_title}"',
        user_id=current_user.id,
        metadata={"note_title": note_title},
    )

    # Notify all users in project that notes have been updated (note deleted)
    await emit_content_update(project_id, "notes")

    return None


@router.post("/{note_id}/attachments", status_code=status.HTTP_201_CREATED)
async def add_note_attachment(
    note_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add an attachment (photo) to a note"""
    note = db.query(Note).filter(Note.id == note_id).first()

    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Note not found"
        )

    check_project_permission(note.project_id, current_user, db)

    # Validate file type (includes audio)
    allowed = {
        "image/jpeg",
        "image/png",
        "image/jpg",
        "image/heic",
        "image/webp",
        "audio/mpeg",
        "audio/wav",
        "audio/mp4",
        "audio/webm",
        "audio/aac",
        "audio/ogg",
        "audio/m4a",
        "audio/x-m4a",
        "audio/mp4a-latm",
    }
    content_type = (file.content_type or "").lower()
    if content_type not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"File type {file.content_type} not allowed. Allowed: {', '.join(sorted(allowed))}",
        )

    # Upload to MinIO
    raw = await file.read()
    ext = (file.filename or "blob").split(".")[-1]
    object_name = f"notes/{note_id}/{uuid.uuid4()}.{ext}"
    await minio_client.upload_file(
        raw, object_name, file.content_type or "application/octet-stream"
    )

    # Save attachment row
    attachment = NoteAttachment(
        note_id=note_id,
        filename=file.filename or "attachment",
        file_path=object_name,
        file_type=file.content_type or "application/octet-stream",
        file_size=str(len(raw)),
    )
    db.add(attachment)

    # Mirror as FileNode under project "Notes" so it appears in Files/Gallery
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    notes_folder = (
        db.query(FileNode)
        .filter(
            FileNode.project_id == note.project_id,
            FileNode.parent_id == None,
            FileNode.name == "Notes",
            FileNode.type == FileNodeType.FOLDER,
        )
        .first()
    )
    if not notes_folder:
        notes_folder = FileNode(
            project_id=note.project_id,
            parent_id=None,
            name="Notes",
            type=FileNodeType.FOLDER,
        )
        db.add(notes_folder)
        db.commit()
        db.refresh(notes_folder)

    # Ensure sibling-unique filename
    node_name = attachment.filename or "attachment"
    base, dot, ext2 = node_name.rpartition(".")
    candidate = node_name
    i = 1
    while (
        db.query(FileNode)
        .filter(
            FileNode.project_id == note.project_id,
            FileNode.parent_id == notes_folder.id,
            FileNode.name == candidate,
        )
        .first()
    ):
        candidate = (
            f"{base or node_name} ({i}){dot}{ext2}" if dot else f"{node_name} ({i})"
        )
        i += 1

    mirrored_node = FileNode(
        project_id=note.project_id,
        parent_id=notes_folder.id,
        name=candidate,
        type=FileNodeType.FILE,
        mime_type=attachment.file_type,
        size=attachment.file_size,
        storage_path=attachment.file_path,
        owner_id=current_user.id,
    )
    db.add(mirrored_node)
    db.flush()
    mirrored_node.acl_root_id = notes_folder.acl_root_id
    db.flush()

    record_create(
        db,
        node=mirrored_node,
        actor_id=current_user.id,
        summary=f'Uploaded attachment "{candidate}"',
    )

    db.commit()
    db.refresh(attachment)

    # Log activity
    await log_activity(
        db=db,
        project_id=note.project_id,
        activity_type="NOTE_ATTACHMENT_ADDED",
        description=f'Added attachment "{attachment.filename}" to note "{note.title}"',
        user_id=current_user.id,
        metadata={"note_id": note.id, "attachment_name": attachment.filename},
    )

    # Notify all users in project that notes have been updated (attachment added)
    await emit_content_update(note.project_id, "notes")

    # Kick off transcription for audio attachments in the background
    is_audio = (attachment.file_type or "").startswith("audio/")
    if is_audio and not settings.DISABLE_WHISPER:
        note.transcription_status = "pending"
        db.commit()
        background_tasks.add_task(
            transcribe_note_audio,
            note_id=note.id,
            attachment_id=attachment.id,
            storage_path=attachment.file_path,
            filename=attachment.filename,
            project_id=note.project_id,
            author_id=current_user.id,
        )

    return {
        "id": attachment.id,
        "filename": attachment.filename,
        "file_type": attachment.file_type,
        "file_size": attachment.file_size,
        "uploaded_at": attachment.uploaded_at,
        "url": minio_client.get_presigned_url(attachment.file_path),
    }


@router.delete(
    "/{note_id}/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_note_attachment(
    note_id: str,
    attachment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete an attachment from a note"""
    note = db.query(Note).filter(Note.id == note_id).first()

    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Note not found"
        )

    check_project_permission(note.project_id, current_user, db)

    attachment = (
        db.query(NoteAttachment)
        .filter(
            NoteAttachment.id == attachment_id, NoteAttachment.note_id == note_id
        )
        .first()
    )

    if not attachment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found"
        )

    # Store info before deletion
    attachment_filename = attachment.filename
    note_title = note.title
    project_id = note.project_id

    # Snapshot and delete the mirrored FileNode (keep storage for 7 days)
    mirrored_node = (
        db.query(FileNode)
        .filter(
            FileNode.project_id == note.project_id,
            FileNode.storage_path == attachment.file_path,
        )
        .first()
    )
    if mirrored_node:
        record_snapshot(
            db,
            project_id=note.project_id,
            node=mirrored_node,
            kind=SnapshotKind.DELETE,
            reason=SnapshotReason.DELETE,
            actor_id=current_user.id,
            payload={
                "name": mirrored_node.name,
                "type": mirrored_node.type.value,
                "parent_id": mirrored_node.parent_id,
                "owner_id": mirrored_node.owner_id,
                "mime_type": mirrored_node.mime_type,
                "size": mirrored_node.size,
                "storage_path": mirrored_node.storage_path,
                "is_acl_root": mirrored_node.is_acl_root,
            },
            summary=f'Deleted attachment "{attachment.filename}"',
        )
        db.delete(mirrored_node)

    # Delete from database
    db.delete(attachment)
    db.commit()

    # Log activity
    await log_activity(
        db=db,
        project_id=project_id,
        activity_type="NOTE_ATTACHMENT_DELETED",
        description=f'Deleted attachment "{attachment_filename}" from note "{note_title}"',
        user_id=current_user.id,
        metadata={"note_title": note_title, "attachment_name": attachment_filename},
    )

    # Notify all users in project that notes have been updated (attachment deleted)
    await emit_content_update(project_id, "notes")

    return None


@router.patch("/{note_id}/transcription", status_code=status.HTTP_200_OK)
async def update_transcription(
    note_id: str,
    text: str = Body(..., embed=True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the transcription text for a voice note (user edits)."""
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    check_project_permission(note.project_id, current_user, db)

    note.transcription = text
    note.transcription_modified = True
    db.commit()

    await log_activity(
        db=db,
        project_id=note.project_id,
        activity_type="NOTE_TRANSCRIPTION_EDITED",
        description=f'Edited transcription for voice note "{note.title}"',
        user_id=current_user.id,
        metadata={"note_id": note.id},
    )
    await emit_content_update(note.project_id, "notes")

    return {
        "transcription": note.transcription,
        "transcription_modified": note.transcription_modified,
    }


@router.post("/{note_id}/transcription/reset", status_code=status.HTTP_200_OK)
async def reset_transcription(
    note_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Reset transcription back to the original AI-generated text."""
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    check_project_permission(note.project_id, current_user, db)

    if not note.transcription_original:
        raise HTTPException(status_code=400, detail="No original transcription to reset to")

    note.transcription = note.transcription_original
    note.transcription_modified = False
    db.commit()

    await log_activity(
        db=db,
        project_id=note.project_id,
        activity_type="NOTE_TRANSCRIPTION_RESET",
        description=f'Reset transcription to original for voice note "{note.title}"',
        user_id=current_user.id,
        metadata={"note_id": note.id},
    )
    await emit_content_update(note.project_id, "notes")

    return {
        "transcription": note.transcription,
        "transcription_modified": note.transcription_modified,
    }


@router.get("/{note_id}/attachments/{attachment_id}/stream")
async def stream_note_attachment(
    note_id: str,
    attachment_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Stream an attachment through the backend.
    This proxies the file from MinIO so mobile devices can access it without
    needing direct MinIO connectivity.
    Supports HTTP Range requests required by iOS AVFoundation (AVPlayer).
    """

    from fastapi.responses import Response

    note = db.query(Note).filter(Note.id == note_id).first()

    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Note not found"
        )

    check_project_permission(note.project_id, current_user, db)

    attachment = (
        db.query(NoteAttachment)
        .filter(
            NoteAttachment.id == attachment_id, NoteAttachment.note_id == note_id
        )
        .first()
    )

    if not attachment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found"
        )

    # Get file from MinIO
    file_data = await minio_client.get_file(attachment.file_path)
    if not file_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="File not found in storage"
        )

    total_size = len(file_data)
    content_type = attachment.file_type or "application/octet-stream"
    base_headers = {
        "Content-Disposition": f'inline; filename="{attachment.filename}"',
        "Accept-Ranges": "bytes",
    }

    # Handle Range requests (required by iOS AVFoundation / AVPlayer)
    range_header = request.headers.get("range")
    if range_header:
        # Parse "bytes=start-end"
        try:
            range_spec = range_header.replace("bytes=", "")
            parts = range_spec.split("-")
            start = int(parts[0]) if parts[0] else 0
            end = int(parts[1]) if parts[1] else total_size - 1
        except (ValueError, IndexError):
            start = 0
            end = total_size - 1

        # Clamp
        start = max(0, start)
        end = min(end, total_size - 1)
        content_length = end - start + 1

        return Response(
            content=file_data[start : end + 1],
            status_code=206,
            media_type=content_type,
            headers={
                **base_headers,
                "Content-Range": f"bytes {start}-{end}/{total_size}",
                "Content-Length": str(content_length),
            },
        )

    # Full response (no Range header)
    return Response(
        content=file_data,
        status_code=200,
        media_type=content_type,
        headers={
            **base_headers,
            "Content-Length": str(total_size),
        },
    )
