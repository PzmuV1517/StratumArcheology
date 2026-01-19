import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import check_project_permission, get_current_user
from app.minio_client import minio_client
from app.models import FileNode, FileNodeType, Note, NoteAttachment, NoteFileLink, User
from app.schemas import NoteCreate, NoteResponse, NoteUpdate
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

    # Voice notes do NOT create a .txt file node; text notes do
    is_voice = getattr(note_data, "is_voice", False)
    if not is_voice:
        # Ensure "Notes" folder exists
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

        # Upload .txt content to object storage
        filename = f"{note.title}.txt"
        storage_path = f"notes/{note.project_id}/{note.id}.txt"
        await minio_client.upload_file(
            (note.content or "").encode("utf-8"), storage_path, "text/plain"
        )

        # Mirror as FileNode
        note_node = FileNode(
            project_id=note.project_id,
            parent_id=notes_folder.id,
            name=filename,
            type=FileNodeType.FILE,
            storage_path=storage_path,
            mime_type="text/plain",
        )
        db.add(note_node)
        db.commit()
        db.refresh(note_node)

        # Link note to its txt FileNode for future sync/update
        link = NoteFileLink(note_id=note.id, file_node_id=note_node.id)
        db.add(link)
        db.commit()

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
    return note


@router.get("/project/{project_id}", response_model=list[NoteResponse])
async def get_project_notes(
    project_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Get all notes for a project"""
    check_project_permission(project_id, current_user, db)

    notes = (
        db.query(Note).filter(Note.project_id == project_id).order_by(Note.updated_at.desc()).all()
    )

    # Add presigned URLs to attachments
    for note in notes:
        for attachment in note.attachments:
            attachment.url = minio_client.get_presigned_url(attachment.file_path)

    return notes


@router.get("/{note_id}", response_model=NoteResponse)
async def get_note(
    note_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Get a specific note"""
    note = db.query(Note).filter(Note.id == note_id).first()

    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")

    check_project_permission(note.project_id, current_user, db)

    # Try to sync content from txt file if it exists
    file_link = db.query(NoteFileLink).filter(NoteFileLink.note_id == note_id).first()
    if file_link and file_link.file_node and file_link.file_node.storage_path:
        try:
            # Get content from txt file
            file_data = await minio_client.get_file(file_link.file_node.storage_path)
            file_content = file_data.decode("utf-8")

            # Update note content if it differs (file was edited externally)
            if note.content != file_content:
                note.content = file_content
                note.updated_at = datetime.utcnow()
                db.commit()
                db.refresh(note)
        except Exception as e:
            # If file doesn't exist or can't be read, keep database content
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")

    check_project_permission(note.project_id, current_user, db)

    # Get the linked file node
    file_link = db.query(NoteFileLink).filter(NoteFileLink.note_id == note_id).first()
    file_node = file_link.file_node if file_link else None

    # Update fields
    if note_data.title is not None:
        note.title = note_data.title
        # Update filename in file node
        if file_node:
            file_node.name = f"{note_data.title}.txt"
            file_node.updated_at = datetime.utcnow()

    if note_data.content is not None:
        note.content = note_data.content
        # Update txt file content in MinIO
        if file_node and file_node.storage_path:
            content_bytes = (note_data.content or "").encode("utf-8")
            await minio_client.upload_file(content_bytes, file_node.storage_path, "text/plain")
            file_node.size = str(len(content_bytes))
            file_node.updated_at = datetime.utcnow()

    note.updated_at = datetime.utcnow()

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
    note_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Sync note content from its associated txt file"""
    note = db.query(Note).filter(Note.id == note_id).first()

    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")

    check_project_permission(note.project_id, current_user, db)

    # Get the linked file node
    file_link = db.query(NoteFileLink).filter(NoteFileLink.note_id == note_id).first()
    if not file_link or not file_link.file_node or not file_link.file_node.storage_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="No associated txt file found"
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

        db.commit()
        db.refresh(note)

        return note

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to sync from file: {str(e)}",
        )


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    note_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Delete a note"""
    note = db.query(Note).filter(Note.id == note_id).first()

    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")

    check_project_permission(note.project_id, current_user, db)

    # Only author or project leader can delete
    if note.author_id != current_user.id:
        check_project_permission(note.project_id, current_user, db, required_role="leader")

    # Delete txt file from MinIO
    file_link = db.query(NoteFileLink).filter(NoteFileLink.note_id == note_id).first()
    if file_link and file_link.file_node and file_link.file_node.storage_path:
        await minio_client.delete_file(file_link.file_node.storage_path)
        db.delete(file_link.file_node)

    # Delete attachments from MinIO
    for attachment in note.attachments:
        await minio_client.delete_file(attachment.file_path)

    project_id = note.project_id  # Store before deletion
    note_title = note.title  # Store before deletion
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
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add an attachment (photo) to a note"""
    note = db.query(Note).filter(Note.id == note_id).first()

    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")

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
    }
    if (file.content_type or "") not in allowed:
        raise HTTPException(status_code=400, detail=f"File type {file.content_type} not allowed")

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
        candidate = f"{base or node_name} ({i}){dot}{ext2}" if dot else f"{node_name} ({i})"
        i += 1

    mirrored_node = FileNode(
        project_id=note.project_id,
        parent_id=notes_folder.id,
        name=candidate,
        type=FileNodeType.FILE,
        mime_type=attachment.file_type,
        size=attachment.file_size,
        storage_path=attachment.file_path,
    )
    db.add(mirrored_node)

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

    return {
        "id": attachment.id,
        "filename": attachment.filename,
        "file_type": attachment.file_type,
        "file_size": attachment.file_size,
        "uploaded_at": attachment.uploaded_at,
        "url": minio_client.get_presigned_url(attachment.file_path),
    }


@router.delete("/{note_id}/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note_attachment(
    note_id: str,
    attachment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete an attachment from a note"""
    note = db.query(Note).filter(Note.id == note_id).first()

    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")

    check_project_permission(note.project_id, current_user, db)

    attachment = (
        db.query(NoteAttachment)
        .filter(NoteAttachment.id == attachment_id, NoteAttachment.note_id == note_id)
        .first()
    )

    if not attachment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")

    # Delete from MinIO
    await minio_client.delete_file(attachment.file_path)

    # Store info before deletion
    attachment_filename = attachment.filename
    note_title = note.title
    project_id = note.project_id

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
