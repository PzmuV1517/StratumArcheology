from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.dependencies import get_current_user, check_project_permission
from app.models import User, Project, project_members, FileNode, FileNodeType
from app.schemas import (
    ProjectCreate, ProjectResponse, ProjectWithMembers,
    ProjectMemberAdd, ProjectMemberUpdate, UserResponse
)
from sqlalchemy import select
from app.websocket import emit_member_kicked, emit_role_changed, emit_member_update, log_activity

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def create_project(
    project_data: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new archaeological site project"""
    project = Project(
        name=project_data.name,
        description=project_data.description,
        ran_lmi_id=project_data.ran_lmi_id,
        owner_id=current_user.id
    )
    
    db.add(project)
    db.commit()
    db.refresh(project)
    
    # Add the owner as a member with leader role
    project.members.append(current_user)
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
        activity_type='project_created',
        description=f'Project "{project.name}" was created',
        user_id=current_user.id,
        metadata={'project_name': project.name}
    )
    
    return project


@router.get("/", response_model=List[ProjectResponse])
@router.get("", response_model=List[ProjectResponse], include_in_schema=False)
async def get_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all projects the user has access to"""
    # Get owned projects
    owned = db.query(Project).filter(Project.owner_id == current_user.id).all()
    
    # Get projects where user is a member
    stmt = select(Project).join(project_members).where(
        project_members.c.user_id == current_user.id
    )
    member_projects = db.execute(stmt).scalars().all()
    
    # Combine and deduplicate
    all_projects = {p.id: p for p in owned + list(member_projects)}
    
    return list(all_projects.values())


@router.get("/{project_id}", response_model=ProjectWithMembers)
async def get_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get project details with members and their roles"""
    from sqlalchemy.orm import joinedload
    
    check_project_permission(project_id, current_user, db)
    
    project = db.query(Project).filter(Project.id == project_id).first()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Fetch members with their roles from the join table
    members_with_roles = db.execute(
        select(User, project_members.c.role)
        .join(project_members, User.id == project_members.c.user_id)
        .where(project_members.c.project_id == project_id)
    ).all()
    
    # Build response with members including roles
    members_list = []
    for user, role in members_with_roles:
        # Owner always has LEADER role
        member_role = "leader" if user.id == project.owner_id else (role.value if role else "guest")
        members_list.append({
            "id": user.id,
            "email": user.email,
            "display_name": user.display_name,
            "photo_url": user.photo_url,
            "role": member_role
        })
    
    # Return project with properly formatted members
    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "ran_lmi_id": project.ran_lmi_id,
        "owner_id": project.owner_id,
        "created_at": project.created_at,
        "updated_at": project.updated_at,
        "is_active": project.is_active,
        "members": members_list
    }


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    project_data: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update project details (owner only)"""
    project = db.query(Project).filter(Project.id == project_id).first()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    if project.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the project owner can update project details"
        )
    
    project.name = project_data.name
    project.description = project_data.description
    project.ran_lmi_id = project_data.ran_lmi_id
    
    db.commit()
    db.refresh(project)
    
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a project (owner only)"""
    project = db.query(Project).filter(Project.id == project_id).first()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    if project.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the project owner can delete the project"
        )
    
    db.delete(project)
    db.commit()
    
    return None


@router.post("/{project_id}/members", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def add_project_member(
    project_id: str,
    member_data: ProjectMemberAdd,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a member to the project (leader/owner only)"""
    check_project_permission(project_id, current_user, db, required_role="leader")
    
    # Check if user exists
    user = db.query(User).filter(User.id == member_data.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if already a member
    stmt = select(project_members).where(
        project_members.c.project_id == project_id,
        project_members.c.user_id == member_data.user_id
    )
    existing = db.execute(stmt).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this project"
        )
    
    # Add member
    stmt = project_members.insert().values(
        project_id=project_id,
        user_id=member_data.user_id,
        role=member_data.role
    )
    db.execute(stmt)
    db.commit()
    
    # Log activity for timeline
    await log_activity(
        db=db,
        project_id=project_id,
        activity_type='member_joined',
        description=f'{user.display_name} joined the project as {member_data.role}',
        user_id=current_user.id,
        metadata={'new_member_id': user.id, 'role': str(member_data.role)}
    )
    
    return user


@router.delete("/{project_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_project_member(
    project_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a member from the project (leader can remove anyone, researcher can remove guests only)"""
    # First check basic project access
    check_project_permission(project_id, current_user, db)
    
    project = db.query(Project).filter(Project.id == project_id).first()
    
    # Get current user's role
    if project.owner_id == current_user.id:
        current_user_role = "leader"
    else:
        stmt = select(project_members).where(
            project_members.c.project_id == project_id,
            project_members.c.user_id == current_user.id
        )
        result = db.execute(stmt).first()
        current_user_role = result.role.value if result else "guest"
    
    # Get target user's role
    target_stmt = select(project_members).where(
        project_members.c.project_id == project_id,
        project_members.c.user_id == user_id
    )
    target_result = db.execute(target_stmt).first()
    
    if not target_result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found in project"
        )
    
    target_role = target_result.role.value
    
    # Role hierarchy check: can only remove members with lower roles
    role_hierarchy = {'leader': 3, 'researcher': 2, 'guest': 1}
    
    if role_hierarchy.get(current_user_role, 0) <= role_hierarchy.get(target_role, 0):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only remove members with lower roles than yours"
        )
    
    stmt = project_members.delete().where(
        project_members.c.project_id == project_id,
        project_members.c.user_id == user_id
    )
    db.execute(stmt)
    db.commit()
    
    # Log activity for timeline
    removed_user = db.query(User).filter(User.id == user_id).first()
    await log_activity(
        db=db,
        project_id=project_id,
        activity_type='member_left',
        description=f'{removed_user.display_name if removed_user else "User"} was removed from the project',
        user_id=current_user.id,
        metadata={'removed_member_id': user_id}
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
    db: Session = Depends(get_db)
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
            project_members.c.user_id == current_user.id
        )
        result = db.execute(stmt).first()
        current_user_role = result.role.value if result else "guest"
    
    # Get target user's current role
    target_stmt = select(project_members).where(
        project_members.c.project_id == project_id,
        project_members.c.user_id == user_id
    )
    target_result = db.execute(target_stmt).first()
    
    if not target_result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found in project"
        )
    
    target_current_role = target_result.role.value
    new_role = role_data.role.lower() if isinstance(role_data.role, str) else role_data.role.value
    
    role_hierarchy = {'leader': 3, 'researcher': 2, 'guest': 1}
    
    # Leaders can do anything (except promote to leader, that's transfer)
    if current_user_role == "leader":
        if new_role == "leader":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Use the transfer ownership endpoint to transfer leadership"
            )
    # Researchers can only promote guests to researcher
    elif current_user_role == "researcher":
        if target_current_role != "guest":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Researchers can only modify guest roles"
            )
        if new_role not in ["guest", "researcher"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Researchers can only promote guests to researcher"
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Guests cannot modify member roles"
        )
    
    stmt = project_members.update().where(
        project_members.c.project_id == project_id,
        project_members.c.user_id == user_id
    ).values(role=new_role)
    
    db.execute(stmt)
    db.commit()
    
    # Log activity for timeline
    target_user = db.query(User).filter(User.id == user_id).first()
    await log_activity(
        db=db,
        project_id=project_id,
        activity_type='member_role_changed',
        description=f'{target_user.display_name if target_user else "User"} role changed from {target_current_role} to {new_role}',
        user_id=current_user.id,
        metadata={'member_id': user_id, 'old_role': target_current_role, 'new_role': new_role}
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
    new_owner_id: str = None
):
    """Transfer project ownership to another member (owner only)"""
    from pydantic import BaseModel
    
    project = db.query(Project).filter(Project.id == project_id).first()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    if project.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the project owner can transfer ownership"
        )
    
    if not new_owner_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New owner ID is required"
        )
    
    # Check if new owner is a member
    stmt = select(project_members).where(
        project_members.c.project_id == project_id,
        project_members.c.user_id == new_owner_id
    )
    new_owner_membership = db.execute(stmt).first()
    
    if not new_owner_membership:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New owner must be a project member"
        )
    
    # Update project owner
    old_owner_id = project.owner_id
    project.owner_id = new_owner_id
    
    # Update new owner's role to leader
    stmt = project_members.update().where(
        project_members.c.project_id == project_id,
        project_members.c.user_id == new_owner_id
    ).values(role="leader")
    db.execute(stmt)
    
    # Update old owner's role to researcher
    stmt = project_members.update().where(
        project_members.c.project_id == project_id,
        project_members.c.user_id == old_owner_id
    ).values(role="researcher")
    db.execute(stmt)
    
    db.commit()
    
    return {"message": "Ownership transferred successfully", "new_owner_id": new_owner_id}
