from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional
import secrets
import string

from app.database import get_db
from app.dependencies import get_current_user, check_project_permission
from app.models import User, Project, ProjectInvite, project_members, UserRole
from app.schemas import InviteCreateRequest, InviteResponse, InviteAcceptRequest, InviteAcceptResponse, InviteJoinByCodeRequest
from sqlalchemy import select

router = APIRouter(tags=["invites"])


def generate_short_code(project_id: str, length: int = 6) -> str:
    """Generate a short invite code like 'PRJ-ABC123' using first 3 chars of project ID as prefix."""
    prefix = project_id[:3].upper()
    # Use uppercase letters and digits for the random part (excluding confusing chars)
    chars = string.ascii_uppercase.replace('O', '').replace('I', '') + string.digits.replace('0', '').replace('1', '')
    random_part = ''.join(secrets.choice(chars) for _ in range(length))
    return f"{prefix}-{random_part}"


def generate_unique_code(db: Session, project_id: str, max_attempts: int = 10) -> str:
    """Generate a unique short code that doesn't exist in the database."""
    for _ in range(max_attempts):
        code = generate_short_code(project_id)
        existing = db.query(ProjectInvite).filter(ProjectInvite.code == code).first()
        if not existing:
            return code
    # If we can't generate unique after max attempts, use longer random
    return generate_short_code(project_id, length=10)


@router.post("/projects/{project_id}/invites", response_model=InviteResponse, status_code=status.HTTP_201_CREATED)
async def create_invite(
    project_id: str,
    body: InviteCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a single-use invite token for a project (leader/owner only)."""
    check_project_permission(project_id, current_user, db, required_role="leader")

    # Validate project exists
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    expires_at: Optional[datetime] = None
    if body.ttl_hours and body.ttl_hours > 0:
        expires_at = datetime.utcnow() + timedelta(hours=body.ttl_hours)
    else:
        # default 14 days
        expires_at = datetime.utcnow() + timedelta(days=14)

    # Generate unique short code
    short_code = generate_unique_code(db, project_id)

    invite = ProjectInvite(
        project_id=project_id,
        code=short_code,
        role=body.role,
        created_by=current_user.id,
        expires_at=expires_at
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)

    return InviteResponse(
        token=invite.token,
        code=invite.code,
        project_id=project_id,
        role=invite.role.value if hasattr(invite.role, 'value') else str(invite.role),
        expires_at=invite.expires_at,
        accept_path=f"/invite?token={invite.token}"
    )


@router.post("/invites/accept", response_model=InviteAcceptResponse)
async def accept_invite(
    body: InviteAcceptRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Accept an invite token and join the project with the invited role."""
    token = body.token

    invite: ProjectInvite = db.query(ProjectInvite).filter(ProjectInvite.token == token).first()
    if not invite:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found")
    if invite.used:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite already used")
    if invite.expires_at and invite.expires_at < datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite expired")

    # Check if user already a member
    stmt = select(project_members).where(
        project_members.c.project_id == invite.project_id,
        project_members.c.user_id == current_user.id
    )
    existing = db.execute(stmt).first()

    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You are already a member of this project")

    # Add membership
    role_value = invite.role.value if hasattr(invite.role, 'value') else str(invite.role)
    db.execute(
            project_members.insert().values(
            project_id=invite.project_id,
            user_id=current_user.id,
            role=role_value
        )
    )

    # Mark invite as used
    invite.used = True
    invite.redeemed_by = current_user.id
    invite.redeemed_at = datetime.utcnow()
    db.commit()

    return InviteAcceptResponse(
        project_id=invite.project_id,
        user_id=current_user.id,
        role=invite.role.value if hasattr(invite.role, 'value') else str(invite.role)
    )


@router.post("/invites/join-by-code", response_model=InviteAcceptResponse)
async def join_by_code(
    body: InviteJoinByCodeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Join a project using a short invite code."""
    code = body.code.strip().upper()

    invite: ProjectInvite = db.query(ProjectInvite).filter(ProjectInvite.code == code).first()
    if not invite:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid invite code")
    if invite.used:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite code already used")
    if invite.expires_at and invite.expires_at < datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite code expired")

    # Check if user already a member
    stmt = select(project_members).where(
        project_members.c.project_id == invite.project_id,
        project_members.c.user_id == current_user.id
    )
    existing = db.execute(stmt).first()

    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You are already a member of this project")

    # Add membership
    role_value = invite.role.value if hasattr(invite.role, 'value') else str(invite.role)
    db.execute(
        project_members.insert().values(
            project_id=invite.project_id,
            user_id=current_user.id,
            role=role_value
        )
    )

    # Mark invite as used
    invite.used = True
    invite.redeemed_by = current_user.id
    invite.redeemed_at = datetime.utcnow()
    db.commit()

    return InviteAcceptResponse(
        project_id=invite.project_id,
        user_id=current_user.id,
        role=role_value
    )
