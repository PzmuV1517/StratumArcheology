"""
Project management API routes.

Handles CRUD operations for archaeological site projects, member management
(add, remove, role changes), ownership transfer, and Harris Matrix data.

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

import uuid

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import check_project_permission, get_current_user
from app.minio_client import minio_client, resolve_storage_url
from app.models import (
    DataVersion,
    FileNode,
    FileNodeType,
    Project,
    User,
    UserRole,
    project_members,
)
from app.schemas import (
    ProjectCreate,
    ProjectMemberAdd,
    ProjectMemberUpdate,
    ProjectResponse,
    ProjectWithMembers,
    PublicProjectDetailResponse,
    PublicProjectResponse,
    UserResponse,
)
from app.websocket import (
    emit_member_kicked,
    emit_member_update,
    emit_role_changed,
    log_activity,
)
from app.wheeler_renderer import generate_wheeler_svg

router = APIRouter(prefix="/projects", tags=["projects"])


# ─── Public project discovery (no auth) ────────────────────────────────────────


@router.get("/public", response_model=list[PublicProjectResponse])
@router.get(
    "/public/", response_model=list[PublicProjectResponse], include_in_schema=False
)
async def get_public_projects(
    q: str | None = Query(None, min_length=1, description="Optional search query"),
    db: Session = Depends(get_db),
):
    """Get publicly visible projects sorted by member count (most popular first).

    Optionally filter by a search term that matches project name or description.
    """
    member_count = func.count(project_members.c.user_id).label("member_count")
    query = (
        db.query(Project, member_count)
        .outerjoin(project_members, Project.id == project_members.c.project_id)
        .filter(Project.is_public.is_(True), Project.is_active.is_(True))
    )

    if q:
        pattern = f"%{q}%"
        query = query.filter(
            (Project.name.ilike(pattern)) | (Project.description.ilike(pattern))
        )

    rows = (
        query.group_by(Project.id)
        .order_by(member_count.desc(), Project.updated_at.desc())
        .limit(50)
        .all()
    )

    results = []
    for proj, count in rows:
        data = PublicProjectResponse.model_validate(proj)
        data.member_count = count
        results.append(data)
    return results


@router.get("/public/{project_id}", response_model=PublicProjectDetailResponse)
async def get_public_project_detail(
    project_id: str,
    db: Session = Depends(get_db),
):
    """Get full details for a single public project (no auth required).

    Returns project info, member list, member count, and GPS bounds.
    """
    import json as _json

    from app.models import ProjectGPS

    project = (
        db.query(Project)
        .filter(
            Project.id == project_id,
            Project.is_public.is_(True),
            Project.is_active.is_(True),
        )
        .first()
    )
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Public project not found"
        )

    # Members -----------------------------------------------------------
    members_with_roles = db.execute(
        select(User, project_members.c.role)
        .join(project_members, User.id == project_members.c.user_id)
        .where(project_members.c.project_id == project_id)
    ).all()

    members_list = []
    owner_found = False
    for user, role in members_with_roles:
        if user.id == project.owner_id:
            owner_found = True
        member_role = (
            "leader"
            if user.id == project.owner_id
            else (role.value if role else "guest")
        )
        members_list.append(
            {
                "id": user.id,
                "email": user.email,
                "display_name": user.display_name,
                "photo_url": resolve_storage_url(user.photo_url),
                "bio": user.bio,
                "role": member_role,
            }
        )

    # Ensure the owner always appears in the member list
    if not owner_found:
        owner = db.query(User).filter(User.id == project.owner_id).first()
        if owner:
            members_list.insert(
                0,
                {
                    "id": owner.id,
                    "email": owner.email,
                    "display_name": owner.display_name,
                    "photo_url": resolve_storage_url(owner.photo_url),
                    "bio": owner.bio,
                    "role": "leader",
                },
            )
            # Repair the join table so this doesn't keep happening
            db.execute(
                project_members.insert().values(
                    project_id=project_id,
                    user_id=owner.id,
                    role=UserRole.LEADER,
                )
            )
            db.commit()

    # GPS / bounds ------------------------------------------------------
    gps_data = None
    gps_row = (
        db.query(ProjectGPS).filter(ProjectGPS.project_id == project_id).first()
    )
    if gps_row and gps_row.data:
        try:
            gps_data = _json.loads(gps_row.data)
        except Exception:
            pass

    # Cover image presigned URL -----------------------------------------
    cover_presigned: str | None = None
    if project.cover_image_url:
        try:
            cover_presigned = minio_client.get_presigned_url(
                project.cover_image_url, expiry=7200
            )
        except Exception:
            pass

    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "ran_lmi_id": project.ran_lmi_id,
        "cover_image_url": cover_presigned,
        "owner_id": project.owner_id,
        "created_at": project.created_at,
        "updated_at": project.updated_at,
        "is_active": project.is_active,
        "is_public": project.is_public,
        "member_count": len(members_list),
        "members": members_list,
        "gps": gps_data,
    }


# ─── Toggle project publicity ──────────────────────────────────────────────────


@router.patch("/{project_id}/publicise", response_model=ProjectResponse)
async def toggle_project_publicity(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Toggle the public visibility of a project. Only the owner can do this."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )
    if project.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the project owner can change publicity",
        )

    project.is_public = not project.is_public
    db.commit()
    db.refresh(project)

    new_state = "public" if project.is_public else "private"
    await log_activity(
        db=db,
        project_id=project_id,
        activity_type="project_publicity_changed",
        description=f'Project "{project.name}" is now {new_state}',
        user_id=current_user.id,
        metadata={"is_public": project.is_public},
    )

    return project


# ─── E2EE key management ───────────────────────────────────────────────────────


@router.get("/{project_id}/e2ee-key")
async def get_e2ee_key(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the E2EE encryption key for a project. Members only."""
    check_project_permission(project_id, current_user, db)
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"e2ee_key": project.e2ee_key}


@router.put("/{project_id}/e2ee-key")
async def set_e2ee_key(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    key: str = None,
):
    """Set or rotate the E2EE encryption key. Only set if not already set (first caller wins)."""
    check_project_permission(project_id, current_user, db)
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if project.e2ee_key and key:
        # Key already exists — only owner can rotate
        if project.owner_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="Only the project owner can rotate the encryption key",
            )

    if key:
        project.e2ee_key = key
        db.commit()

    return {"e2ee_key": project.e2ee_key}


@router.post(
    "/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED
)
@router.post(
    "",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
async def create_project(
    project_data: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new archaeological site project"""
    project = Project(
        name=project_data.name,
        description=project_data.description,
        ran_lmi_id=project_data.ran_lmi_id,
        owner_id=current_user.id,
    )

    db.add(project)
    db.commit()
    db.refresh(project)

    # Add the owner as a member with explicit leader role
    db.execute(
        project_members.insert().values(
            project_id=project.id,
            user_id=current_user.id,
            role=UserRole.LEADER,
        )
    )
    db.commit()

    # Create default Files root folders: Notes (locked)
    notes_folder = FileNode(
        project_id=project.id,
        parent_id=None,
        name="Notes",
        type=FileNodeType.FOLDER,
        is_locked=True,
    )
    db.add(notes_folder)
    db.commit()

    # Log activity for timeline
    await log_activity(
        db=db,
        project_id=project.id,
        activity_type="project_created",
        description=f'Project "{project.name}" was created',
        user_id=current_user.id,
        metadata={"project_name": project.name},
    )

    return project


@router.get("/", response_model=list[ProjectResponse])
@router.get("", response_model=list[ProjectResponse], include_in_schema=False)
async def get_projects(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Get all projects the user has access to"""
    # Get owned projects
    owned = db.query(Project).filter(Project.owner_id == current_user.id).all()

    # Get projects where user is a member
    stmt = (
        select(Project)
        .join(project_members)
        .where(project_members.c.user_id == current_user.id)
    )
    member_projects = db.execute(stmt).scalars().all()

    # Combine and deduplicate
    all_projects = {p.id: p for p in owned + list(member_projects)}

    return list(all_projects.values())


@router.get("/{project_id}", response_model=ProjectWithMembers)
async def get_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get project details with members and their roles"""

    check_project_permission(project_id, current_user, db)

    project = db.query(Project).filter(Project.id == project_id).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )

    # Fetch members with their roles from the join table
    members_with_roles = db.execute(
        select(User, project_members.c.role)
        .join(project_members, User.id == project_members.c.user_id)
        .where(project_members.c.project_id == project_id)
    ).all()

    # Build response with members including roles
    members_list = []
    owner_found = False
    for user, role in members_with_roles:
        if user.id == project.owner_id:
            owner_found = True
        # Owner always has LEADER role
        member_role = (
            "leader"
            if user.id == project.owner_id
            else (role.value if role else "guest")
        )
        members_list.append(
            {
                "id": user.id,
                "email": user.email,
                "display_name": user.display_name,
                "photo_url": resolve_storage_url(user.photo_url),
                "bio": user.bio,
                "role": member_role,
            }
        )

    # Ensure the owner always appears in the member list
    if not owner_found:
        owner = db.query(User).filter(User.id == project.owner_id).first()
        if owner:
            members_list.insert(
                0,
                {
                    "id": owner.id,
                    "email": owner.email,
                    "display_name": owner.display_name,
                    "photo_url": resolve_storage_url(owner.photo_url),
                    "bio": owner.bio,
                    "role": "leader",
                },
            )
            # Also repair the join table so this doesn't keep happening
            db.execute(
                project_members.insert().values(
                    project_id=project_id,
                    user_id=owner.id,
                    role=UserRole.LEADER,
                )
            )
            db.commit()

    # Return project with properly formatted members
    cover_presigned: str | None = None
    if project.cover_image_url:
        try:
            cover_presigned = minio_client.get_presigned_url(
                project.cover_image_url, expiry=7200
            )
        except Exception:
            cover_presigned = None

    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "ran_lmi_id": project.ran_lmi_id,
        "cover_image_url": cover_presigned,
        "owner_id": project.owner_id,
        "created_at": project.created_at,
        "updated_at": project.updated_at,
        "is_active": project.is_active,
        "is_public": project.is_public,
        "members": members_list,
    }


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    project_data: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update project details (owner only)"""
    project = db.query(Project).filter(Project.id == project_id).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )

    if project.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the project owner can update project details",
        )

    project.name = project_data.name
    project.description = project_data.description
    project.ran_lmi_id = project_data.ran_lmi_id

    db.commit()
    db.refresh(project)

    return project


@router.post("/{project_id}/cover-image", response_model=ProjectResponse)
async def upload_cover_image(
    project_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload or replace the cover image for a project (owner only)"""
    project = db.query(Project).filter(Project.id == project_id).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )

    if project.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the project owner can change the cover image",
        )

    content_type = file.content_type or ""
    ALLOWED_TYPES = {
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/heic",
        "image/heif",
    }
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only JPEG, PNG, WebP, GIF, HEIC, or HEIF images are allowed. SVG and other formats are not supported.",
        )

    # Delete old cover image from MinIO if present
    if project.cover_image_url:
        try:
            await minio_client.delete_file(project.cover_image_url)
        except Exception:
            pass

    raw_ext = (file.filename or "image.jpg").rsplit(".", 1)[-1].lower()
    SAFE_EXTS = {"jpg", "jpeg", "png", "webp", "gif", "heic", "heif"}
    ext = raw_ext if raw_ext in SAFE_EXTS else "jpg"
    object_name = f"projects/{project_id}/cover/{uuid.uuid4().hex}.{ext}"

    file_data = await file.read()
    await minio_client.upload_file(file_data, object_name, content_type)

    project.cover_image_url = object_name
    db.commit()
    db.refresh(project)

    presigned: str | None = None
    try:
        presigned = minio_client.get_presigned_url(object_name, expiry=7200)
    except Exception:
        pass

    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "ran_lmi_id": project.ran_lmi_id,
        "cover_image_url": presigned,
        "owner_id": project.owner_id,
        "created_at": project.created_at,
        "updated_at": project.updated_at,
        "is_active": project.is_active,
    }


@router.delete("/{project_id}/cover-image", response_model=ProjectResponse)
async def delete_cover_image(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove the cover image from a project (owner only)"""
    project = db.query(Project).filter(Project.id == project_id).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )

    if project.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the project owner can remove the cover image",
        )

    if project.cover_image_url:
        try:
            await minio_client.delete_file(project.cover_image_url)
        except Exception:
            pass
        project.cover_image_url = None
        db.commit()
        db.refresh(project)

    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "ran_lmi_id": project.ran_lmi_id,
        "cover_image_url": None,
        "owner_id": project.owner_id,
        "created_at": project.created_at,
        "updated_at": project.updated_at,
        "is_active": project.is_active,
    }


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a project (owner only)"""
    project = db.query(Project).filter(Project.id == project_id).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )

    if project.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the project owner can delete the project",
        )

    db.delete(project)
    db.commit()

    return None


@router.post(
    "/{project_id}/members",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_project_member(
    project_id: str,
    member_data: ProjectMemberAdd,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add a member to the project (leader/owner only)"""
    check_project_permission(project_id, current_user, db, required_role="leader")

    # Check if user exists
    user = db.query(User).filter(User.id == member_data.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # Check if already a member
    stmt = select(project_members).where(
        project_members.c.project_id == project_id,
        project_members.c.user_id == member_data.user_id,
    )
    existing = db.execute(stmt).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this project",
        )

    # Add member
    stmt = project_members.insert().values(
        project_id=project_id, user_id=member_data.user_id, role=member_data.role
    )
    db.execute(stmt)
    db.commit()

    # Log activity for timeline
    await log_activity(
        db=db,
        project_id=project_id,
        activity_type="member_joined",
        description=f"{user.display_name} joined the project as {member_data.role}",
        user_id=current_user.id,
        metadata={"new_member_id": user.id, "role": str(member_data.role)},
    )

    return user


@router.delete(
    "/{project_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def remove_project_member(
    project_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove a member from the project (leader can remove anyone, researcher can remove guests only, anyone can remove self)"""
    # First check basic project access
    check_project_permission(project_id, current_user, db)

    project = db.query(Project).filter(Project.id == project_id).first()

    # Check if user is trying to remove themselves (leave project)
    is_self_removal = str(user_id) == str(current_user.id)

    # Owners cannot leave - they must transfer ownership or delete the project
    if is_self_removal and project.owner_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Project owner cannot leave. Transfer leadership or delete the project instead.",
        )

    # Get current user's role
    if project.owner_id == current_user.id:
        current_user_role = "leader"
    else:
        stmt = select(project_members).where(
            project_members.c.project_id == project_id,
            project_members.c.user_id == current_user.id,
        )
        result = db.execute(stmt).first()
        current_user_role = result.role.value if result else "guest"

    # Get target user's role
    target_stmt = select(project_members).where(
        project_members.c.project_id == project_id,
        project_members.c.user_id == user_id,
    )
    target_result = db.execute(target_stmt).first()

    if not target_result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found in project",
        )

    target_role = target_result.role.value

    # Role hierarchy check: can only remove members with lower roles (skip for self-removal)
    if not is_self_removal:
        role_hierarchy = {"leader": 3, "researcher": 2, "guest": 1}

        if role_hierarchy.get(current_user_role, 0) <= role_hierarchy.get(
            target_role, 0
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only remove members with lower roles than yours",
            )

    stmt = project_members.delete().where(
        project_members.c.project_id == project_id,
        project_members.c.user_id == user_id,
    )
    db.execute(stmt)
    db.commit()

    # Log activity for timeline
    removed_user = db.query(User).filter(User.id == user_id).first()
    await log_activity(
        db=db,
        project_id=project_id,
        activity_type="member_left",
        description=f"{removed_user.display_name if removed_user else 'User'} was removed from the project",
        user_id=current_user.id,
        metadata={"removed_member_id": user_id},
    )

    # Emit WebSocket event to notify the kicked user
    await emit_member_kicked(project_id, user_id)

    # Notify all other members that the member list updated
    await emit_member_update(project_id)

    return None


@router.put("/{project_id}/members/{user_id}/role")
async def update_member_role(
    project_id: str,
    user_id: str,
    role_data: ProjectMemberUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a member's role (leader can change any role, researcher can promote guests to researcher)"""
    # First check basic project access
    check_project_permission(project_id, current_user, db)

    project = db.query(Project).filter(Project.id == project_id).first()

    # Get current user's role
    if project.owner_id == current_user.id:
        current_user_role = "leader"
    else:
        stmt = select(project_members).where(
            project_members.c.project_id == project_id,
            project_members.c.user_id == current_user.id,
        )
        result = db.execute(stmt).first()
        current_user_role = result.role.value if result else "guest"

    # Get target user's current role
    target_stmt = select(project_members).where(
        project_members.c.project_id == project_id,
        project_members.c.user_id == user_id,
    )
    target_result = db.execute(target_stmt).first()

    if not target_result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found in project",
        )

    target_current_role = target_result.role.value
    new_role = (
        role_data.role.lower()
        if isinstance(role_data.role, str)
        else role_data.role.value
    )

    role_hierarchy = {"leader": 3, "researcher": 2, "guest": 1}

    # Leaders can do anything (except promote to leader, that's transfer)
    if current_user_role == "leader":
        if new_role == "leader":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Use the transfer ownership endpoint to transfer leadership",
            )
    # Researchers can only promote guests to researcher
    elif current_user_role == "researcher":
        if target_current_role != "guest":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Researchers can only modify guest roles",
            )
        if new_role not in ["guest", "researcher"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Researchers can only promote guests to researcher",
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Guests cannot modify member roles",
        )

    stmt = (
        project_members.update()
        .where(
            project_members.c.project_id == project_id,
            project_members.c.user_id == user_id,
        )
        .values(role=new_role)
    )

    db.execute(stmt)
    db.commit()

    # Log activity for timeline
    target_user = db.query(User).filter(User.id == user_id).first()
    await log_activity(
        db=db,
        project_id=project_id,
        activity_type="member_role_changed",
        description=f"{target_user.display_name if target_user else 'User'} role changed from {target_current_role} to {new_role}",
        user_id=current_user.id,
        metadata={
            "member_id": user_id,
            "old_role": target_current_role,
            "new_role": new_role,
        },
    )

    # Emit WebSocket event to notify the user their role changed
    await emit_role_changed(project_id, user_id, new_role)

    # Notify all members that the member list updated
    await emit_member_update(project_id)

    return {"message": "Role updated successfully"}


@router.post("/{project_id}/transfer-ownership")
async def transfer_ownership(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    new_owner_id: str = None,
):
    """Transfer project ownership to another member (owner only)"""

    project = db.query(Project).filter(Project.id == project_id).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )

    if project.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the project owner can transfer ownership",
        )

    if not new_owner_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New owner ID is required",
        )

    # Check if new owner is a member
    stmt = select(project_members).where(
        project_members.c.project_id == project_id,
        project_members.c.user_id == new_owner_id,
    )
    new_owner_membership = db.execute(stmt).first()

    if not new_owner_membership:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New owner must be a project member",
        )

    # Update project owner
    old_owner_id = project.owner_id
    project.owner_id = new_owner_id

    # Update new owner's role to leader
    stmt = (
        project_members.update()
        .where(
            project_members.c.project_id == project_id,
            project_members.c.user_id == new_owner_id,
        )
        .values(role="leader")
    )
    db.execute(stmt)

    # Update old owner's role to researcher
    stmt = (
        project_members.update()
        .where(
            project_members.c.project_id == project_id,
            project_members.c.user_id == old_owner_id,
        )
        .values(role="researcher")
    )
    db.execute(stmt)

    db.commit()

    return {
        "message": "Ownership transferred successfully",
        "new_owner_id": new_owner_id,
    }


@router.get("/{project_id}/harris-matrix")
async def get_harris_matrix(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get Harris Matrix data for a project"""
    check_project_permission(project_id, current_user, db)

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )

    # Return the stored Harris Matrix data or empty default
    return {
        "project_id": project_id,
        "data": project.harris_matrix_data or {},
    }


@router.put("/{project_id}/harris-matrix")
async def update_harris_matrix(
    project_id: str,
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update Harris Matrix data for a project"""
    check_project_permission(project_id, current_user, db)

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )

    # Store the Harris Matrix data with version tracking
    old_data = project.harris_matrix_data
    new_data = payload.get("data", {})
    project.harris_matrix_data = new_data

    # Bump version and snapshot old data for Time Machine
    project.harris_matrix_version = (project.harris_matrix_version or 0) + 1
    if old_data:
        snapshot = DataVersion(
            project_id=project_id,
            data_type="harris_matrix",
            version=project.harris_matrix_version - 1,
            data=old_data,
            created_by=str(current_user.id),
        )
        db.add(snapshot)

    db.commit()

    # Log activity for timeline
    await log_activity(
        db=db,
        project_id=project_id,
        activity_type="HARRIS_MATRIX_UPDATED",
        description=f"Harris Matrix updated by {current_user.email}",
        user_id=str(current_user.id),
        metadata={"updated_by": current_user.email},
    )

    return {
        "message": "Harris Matrix data updated successfully",
        "project_id": project_id,
        "version": project.harris_matrix_version,
    }


# ---------------------------------------------------------------------------
# Wheeler diagram data
# ---------------------------------------------------------------------------


@router.get("/{project_id}/wheeler")
async def get_wheeler_data(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get Wheeler Stratigraphic Notation data for a project"""
    check_project_permission(project_id, current_user, db)

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )

    render_url: str | None = None
    if project.wheeler_render_path and minio_client.available:
        try:
            render_url = minio_client.get_presigned_url_for_bucket(
                "wheeler-renders", project.wheeler_render_path
            )
        except Exception:
            pass

    return {
        "project_id": project_id,
        "data": project.wheeler_data or {"trenches": [], "placements": []},
        "version": project.wheeler_data_version or 0,
        "render_url": render_url,
        "render_version": project.wheeler_render_version,
    }


@router.put("/{project_id}/wheeler")
async def update_wheeler_data(
    project_id: str,
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update Wheeler Stratigraphic Notation data for a project"""
    check_project_permission(project_id, current_user, db)

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )

    old_data = project.wheeler_data
    new_data = payload.get("data", {"trenches": [], "placements": []})
    project.wheeler_data = new_data

    # Bump version and snapshot old data for Time Machine
    project.wheeler_data_version = (project.wheeler_data_version or 0) + 1
    if old_data:
        snapshot = DataVersion(
            project_id=project_id,
            data_type="wheeler",
            version=project.wheeler_data_version - 1,
            data=old_data,
            created_by=str(current_user.id),
        )
        db.add(snapshot)

    db.commit()

    # Generate and store publication SVG
    render_url: str | None = None
    render_version: int | None = None
    try:
        svg_text = generate_wheeler_svg(new_data)
        render_key = f"{project_id}/v{project.wheeler_data_version}.svg"
        minio_client.ensure_bucket("wheeler-renders")
        minio_client.upload_text("wheeler-renders", render_key, svg_text)
        project.wheeler_render_path = render_key
        project.wheeler_render_version = project.wheeler_data_version
        db.commit()
        render_url = minio_client.get_presigned_url_for_bucket(
            "wheeler-renders", render_key
        )
        render_version = project.wheeler_render_version
    except Exception as exc:
        print(f"⚠ Wheeler SVG render/upload failed (non-fatal): {exc}")

    # Log activity for timeline
    await log_activity(
        db=db,
        project_id=project_id,
        activity_type="WHEELER_DATA_UPDATED",
        description=f"Wheeler diagram updated by {current_user.email}",
        user_id=str(current_user.id),
        metadata={"updated_by": current_user.email},
    )

    return {
        "message": "Wheeler data updated successfully",
        "project_id": project_id,
        "version": project.wheeler_data_version,
        "render_url": render_url,
        "render_version": render_version,
    }


# ---------------------------------------------------------------------------
# Data version history (Time Machine for Harris Matrix & Wheeler)
# ---------------------------------------------------------------------------


@router.get("/{project_id}/data-versions/{data_type}")
async def get_data_versions(
    project_id: str,
    data_type: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get version history for a project's matrix/notation data.

    Args:
        data_type: ``"harris_matrix"`` or ``"wheeler"``
    """
    check_project_permission(project_id, current_user, db)

    if data_type not in ("harris_matrix", "wheeler"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="data_type must be 'harris_matrix' or 'wheeler'",
        )

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )

    versions = (
        db.query(DataVersion)
        .filter(
            DataVersion.project_id == project_id,
            DataVersion.data_type == data_type,
        )
        .order_by(DataVersion.version.desc())
        .all()
    )

    current_version = (
        project.harris_matrix_version
        if data_type == "harris_matrix"
        else project.wheeler_data_version
    ) or 0

    return {
        "project_id": project_id,
        "data_type": data_type,
        "current_version": current_version,
        "versions": [
            {
                "id": v.id,
                "version": v.version,
                "created_at": v.created_at.isoformat() if v.created_at else None,
                "created_by": v.created_by,
            }
            for v in versions
        ],
    }


@router.post("/{project_id}/data-versions/{data_type}/restore/{version}")
async def restore_data_version(
    project_id: str,
    data_type: str,
    version: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Restore a previous version of harris_matrix or wheeler data.

    Creates a new version snapshot of the current data, then overwrites
    it with the content from the requested version.
    """
    check_project_permission(project_id, current_user, db)

    if data_type not in ("harris_matrix", "wheeler"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="data_type must be 'harris_matrix' or 'wheeler'",
        )

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )

    target_version = (
        db.query(DataVersion)
        .filter(
            DataVersion.project_id == project_id,
            DataVersion.data_type == data_type,
            DataVersion.version == version,
        )
        .first()
    )
    if not target_version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Version {version} not found",
        )

    # Snapshot current data before replacing
    if data_type == "harris_matrix":
        current_data = project.harris_matrix_data
        current_ver = project.harris_matrix_version or 0
    else:
        current_data = project.wheeler_data
        current_ver = project.wheeler_data_version or 0

    if current_data:
        snapshot = DataVersion(
            project_id=project_id,
            data_type=data_type,
            version=current_ver,
            data=current_data,
            created_by=str(current_user.id),
        )
        db.add(snapshot)

    # Restore the old data
    new_ver = current_ver + 1
    if data_type == "harris_matrix":
        project.harris_matrix_data = target_version.data
        project.harris_matrix_version = new_ver
    else:
        project.wheeler_data = target_version.data
        project.wheeler_data_version = new_ver

    db.commit()

    activity_type = (
        "HARRIS_MATRIX_UPDATED"
        if data_type == "harris_matrix"
        else "WHEELER_DATA_UPDATED"
    )
    label = "Harris Matrix" if data_type == "harris_matrix" else "Wheeler diagram"

    await log_activity(
        db=db,
        project_id=project_id,
        activity_type=activity_type,
        description=f"{label} restored to version {version} by {current_user.email}",
        user_id=str(current_user.id),
        metadata={
            "restored_version": version,
            "new_version": new_ver,
            "updated_by": current_user.email,
        },
    )

    return {
        "message": f"{label} restored to version {version}",
        "project_id": project_id,
        "version": new_ver,
    }
