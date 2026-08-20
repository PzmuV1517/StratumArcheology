"""
Channel and User Group management routes for per-project Slack-like chat.

Handles channel CRUD, channel membership, user groups, and group membership.
Auto-creates a default #general channel per project.

MIT License

Copyright (c) 2025 Banu Andrei & Mircea Levin-Constantin
"""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import (
    Channel,
    ChannelMember,
    Project,
    User,
    UserGroup,
    UserGroupMember,
    UserRole,
    project_members,
)
from app.schemas import (
    ChannelCreate,
    ChannelMemberAdd,
    ChannelResponse,
    ChannelUpdate,
    ProjectMemberResponse,
    UserGroupCreate,
    UserGroupMemberAdd,
    UserGroupResponse,
    UserGroupWithMembers,
)

router = APIRouter(tags=["channels"])


# ── Helpers ──────────────────────────────────────────────────────────────────


def _get_member_role(db: Session, project_id: str, user_id: str) -> str | None:
    """Return the role of a user in a project, or None if not a member."""
    row = (
        db.query(project_members.c.role)
        .filter(
            project_members.c.project_id == project_id,
            project_members.c.user_id == user_id,
        )
        .first()
    )
    if row:
        return row[0].value if hasattr(row[0], "value") else str(row[0])
    # Check if owner
    project = db.query(Project).filter(Project.id == project_id).first()
    if project and project.owner_id == user_id:
        return "leader"
    return None


def _require_admin(db: Session, project_id: str, user_id: str):
    """Raise 403 if user is not owner or leader of the project."""
    role = _get_member_role(db, project_id, user_id)
    if role not in ("leader",):
        # Also check owner
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project or project.owner_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only project leaders can perform this action",
            )


def _ensure_default_channel(
    db: Session, project_id: str, user_id: str | None = None
) -> Channel:
    """Ensure a default #general channel exists for the project, creating it if needed."""
    ch = (
        db.query(Channel)
        .filter(Channel.project_id == project_id, Channel.is_default.is_(True))
        .first()
    )
    if ch:
        return ch
    ch = Channel(
        id=str(uuid.uuid4()),
        project_id=project_id,
        name="general",
        description="Default project channel",
        is_default=True,
        created_by=user_id,
        created_at=datetime.utcnow(),
    )
    db.add(ch)
    db.flush()
    # Add all current project members to the default channel
    rows = (
        db.query(project_members.c.user_id)
        .filter(project_members.c.project_id == project_id)
        .all()
    )
    project = db.query(Project).filter(Project.id == project_id).first()
    member_ids = {r[0] for r in rows}
    if project:
        member_ids.add(project.owner_id)
    for uid in member_ids:
        db.add(ChannelMember(channel_id=ch.id, user_id=uid))
    db.commit()
    db.refresh(ch)
    return ch


# ── Channel CRUD ─────────────────────────────────────────────────────────────


@router.get("/projects/{project_id}/channels", response_model=list[ChannelResponse])
async def list_channels(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all channels in a project. Auto-creates #general if needed."""
    role = _get_member_role(db, project_id, current_user.id)
    if role is None:
        raise HTTPException(status_code=403, detail="Not a project member")

    _ensure_default_channel(db, project_id, current_user.id)

    channels = (
        db.query(Channel)
        .filter(Channel.project_id == project_id)
        .order_by(Channel.is_default.desc(), Channel.name)
        .all()
    )
    result = []
    for ch in channels:
        count = (
            db.query(ChannelMember).filter(ChannelMember.channel_id == ch.id).count()
        )
        r = ChannelResponse.model_validate(ch)
        r.member_count = count
        result.append(r)
    return result


@router.post(
    "/projects/{project_id}/channels",
    response_model=ChannelResponse,
    status_code=201,
)
async def create_channel(
    project_id: str,
    body: ChannelCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new channel (leaders only)."""
    _require_admin(db, project_id, current_user.id)

    # Check name uniqueness
    name = body.name.strip().lower().replace(" ", "-")
    existing = (
        db.query(Channel)
        .filter(Channel.project_id == project_id, Channel.name == name)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Channel name already exists")

    ch = Channel(
        id=str(uuid.uuid4()),
        project_id=project_id,
        name=name,
        description=body.description,
        is_default=False,
        created_by=current_user.id,
        created_at=datetime.utcnow(),
    )
    db.add(ch)
    # Auto-add creator
    db.add(ChannelMember(channel_id=ch.id, user_id=current_user.id))
    db.commit()
    db.refresh(ch)
    r = ChannelResponse.model_validate(ch)
    r.member_count = 1
    return r


@router.patch("/channels/{channel_id}", response_model=ChannelResponse)
async def update_channel(
    channel_id: str,
    body: ChannelUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a channel name/description (leaders only)."""
    ch = db.query(Channel).filter(Channel.id == channel_id).first()
    if not ch:
        raise HTTPException(status_code=404, detail="Channel not found")
    _require_admin(db, ch.project_id, current_user.id)

    if body.name is not None:
        name = body.name.strip().lower().replace(" ", "-")
        existing = (
            db.query(Channel)
            .filter(
                Channel.project_id == ch.project_id,
                Channel.name == name,
                Channel.id != channel_id,
            )
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=400, detail="Channel name already exists"
            )
        ch.name = name
    if body.description is not None:
        ch.description = body.description
    db.commit()
    db.refresh(ch)
    count = db.query(ChannelMember).filter(ChannelMember.channel_id == ch.id).count()
    r = ChannelResponse.model_validate(ch)
    r.member_count = count
    return r


@router.delete("/channels/{channel_id}", status_code=204)
async def delete_channel(
    channel_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a channel (leaders only). Cannot delete the default channel."""
    ch = db.query(Channel).filter(Channel.id == channel_id).first()
    if not ch:
        raise HTTPException(status_code=404, detail="Channel not found")
    if ch.is_default:
        raise HTTPException(
            status_code=400, detail="Cannot delete the default channel"
        )
    _require_admin(db, ch.project_id, current_user.id)
    db.delete(ch)
    db.commit()


# ── Channel Members ──────────────────────────────────────────────────────────


@router.post("/channels/{channel_id}/members", status_code=204)
async def add_channel_members(
    channel_id: str,
    body: ChannelMemberAdd,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add users and/or user group members to a channel (leaders only)."""
    ch = db.query(Channel).filter(Channel.id == channel_id).first()
    if not ch:
        raise HTTPException(status_code=404, detail="Channel not found")
    _require_admin(db, ch.project_id, current_user.id)

    user_ids = set(body.user_ids)

    # Expand group memberships
    for gid in body.group_ids:
        group_members = (
            db.query(UserGroupMember.user_id)
            .filter(UserGroupMember.group_id == gid)
            .all()
        )
        user_ids.update(r[0] for r in group_members)

    # Add each user if not already a member
    for uid in user_ids:
        existing = (
            db.query(ChannelMember)
            .filter(
                ChannelMember.channel_id == channel_id, ChannelMember.user_id == uid
            )
            .first()
        )
        if not existing:
            db.add(ChannelMember(channel_id=channel_id, user_id=uid))
    db.commit()


@router.delete("/channels/{channel_id}/members/{user_id}", status_code=204)
async def remove_channel_member(
    channel_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove a user from a channel (leaders or self-leave)."""
    ch = db.query(Channel).filter(Channel.id == channel_id).first()
    if not ch:
        raise HTTPException(status_code=404, detail="Channel not found")
    if user_id != current_user.id:
        _require_admin(db, ch.project_id, current_user.id)
    member = (
        db.query(ChannelMember)
        .filter(
            ChannelMember.channel_id == channel_id, ChannelMember.user_id == user_id
        )
        .first()
    )
    if member:
        db.delete(member)
        db.commit()


@router.get("/channels/{channel_id}/members")
async def list_channel_members(
    channel_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all members of a channel."""
    ch = db.query(Channel).filter(Channel.id == channel_id).first()
    if not ch:
        raise HTTPException(status_code=404, detail="Channel not found")

    members = (
        db.query(User)
        .join(ChannelMember, ChannelMember.user_id == User.id)
        .filter(ChannelMember.channel_id == channel_id)
        .all()
    )
    return [
        {
            "id": u.id,
            "display_name": u.display_name,
            "username": u.username,
            "photo_url": u.photo_url,
            "email": u.email,
        }
        for u in members
    ]


# ── User Groups ──────────────────────────────────────────────────────────────


@router.get("/projects/{project_id}/groups", response_model=list[UserGroupResponse])
async def list_user_groups(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all user groups in a project."""
    role = _get_member_role(db, project_id, current_user.id)
    if role is None:
        raise HTTPException(status_code=403, detail="Not a project member")

    groups = (
        db.query(UserGroup)
        .filter(UserGroup.project_id == project_id)
        .order_by(UserGroup.name)
        .all()
    )
    result = []
    for g in groups:
        count = (
            db.query(UserGroupMember)
            .filter(UserGroupMember.group_id == g.id)
            .count()
        )
        r = UserGroupResponse.model_validate(g)
        r.member_count = count
        result.append(r)
    return result


@router.post(
    "/projects/{project_id}/groups",
    response_model=UserGroupResponse,
    status_code=201,
)
async def create_user_group(
    project_id: str,
    body: UserGroupCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a user group (leaders only)."""
    _require_admin(db, project_id, current_user.id)

    name = body.name.strip().lower().replace(" ", "-")
    existing = (
        db.query(UserGroup)
        .filter(UserGroup.project_id == project_id, UserGroup.name == name)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Group name already exists")

    g = UserGroup(
        id=str(uuid.uuid4()),
        project_id=project_id,
        name=name,
        created_by=current_user.id,
        created_at=datetime.utcnow(),
    )
    db.add(g)
    db.commit()
    db.refresh(g)
    r = UserGroupResponse.model_validate(g)
    r.member_count = 0
    return r


@router.delete("/groups/{group_id}", status_code=204)
async def delete_user_group(
    group_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a user group (leaders only)."""
    g = db.query(UserGroup).filter(UserGroup.id == group_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Group not found")
    _require_admin(db, g.project_id, current_user.id)
    db.delete(g)
    db.commit()


@router.post("/groups/{group_id}/members", status_code=204)
async def add_group_members(
    group_id: str,
    body: UserGroupMemberAdd,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add users to a user group (leaders only)."""
    g = db.query(UserGroup).filter(UserGroup.id == group_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Group not found")
    _require_admin(db, g.project_id, current_user.id)

    for uid in body.user_ids:
        existing = (
            db.query(UserGroupMember)
            .filter(
                UserGroupMember.group_id == group_id, UserGroupMember.user_id == uid
            )
            .first()
        )
        if not existing:
            db.add(UserGroupMember(group_id=group_id, user_id=uid))
    db.commit()


@router.delete("/groups/{group_id}/members/{user_id}", status_code=204)
async def remove_group_member(
    group_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove a user from a user group (leaders only)."""
    g = db.query(UserGroup).filter(UserGroup.id == group_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Group not found")
    _require_admin(db, g.project_id, current_user.id)
    member = (
        db.query(UserGroupMember)
        .filter(
            UserGroupMember.group_id == group_id, UserGroupMember.user_id == user_id
        )
        .first()
    )
    if member:
        db.delete(member)
        db.commit()


@router.get("/groups/{group_id}", response_model=UserGroupWithMembers)
async def get_user_group(
    group_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a user group with its members."""
    g = db.query(UserGroup).filter(UserGroup.id == group_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Group not found")

    members = (
        db.query(User)
        .join(UserGroupMember, UserGroupMember.user_id == User.id)
        .filter(UserGroupMember.group_id == group_id)
        .all()
    )

    # Get roles from project_members
    role_map = {}
    rows = (
        db.query(project_members.c.user_id, project_members.c.role)
        .filter(project_members.c.project_id == g.project_id)
        .all()
    )
    for uid, role in rows:
        role_map[uid] = role

    r = UserGroupWithMembers.model_validate(g)
    r.member_count = len(members)
    r.members = [
        ProjectMemberResponse(
            id=u.id,
            email=u.email,
            display_name=u.display_name,
            photo_url=u.photo_url,
            bio=u.bio,
            role=role_map.get(u.id, UserRole.GUEST),
        )
        for u in members
    ]
    return r


# ── @ mention search ─────────────────────────────────────────────────────────


@router.get("/projects/{project_id}/mentionables")
async def get_mentionables(
    project_id: str,
    q: str = "",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return users and groups that can be @mentioned in a project channel.

    Returns {users: [...], groups: [...]} filtered by optional query.
    """
    role = _get_member_role(db, project_id, current_user.id)
    if role is None:
        raise HTTPException(status_code=403, detail="Not a project member")

    # Get project members
    members_query = (
        db.query(User)
        .join(project_members, project_members.c.user_id == User.id)
        .filter(project_members.c.project_id == project_id)
    )
    # Also include owner
    project = db.query(Project).filter(Project.id == project_id).first()
    if q:
        members_query = members_query.filter(
            (User.display_name.ilike(f"%{q}%")) | (User.username.ilike(f"%{q}%"))
        )
    users = members_query.limit(20).all()

    # If owner matches query and isn't in members list
    if project:
        owner = db.query(User).filter(User.id == project.owner_id).first()
        if owner and owner.id not in {u.id for u in users}:
            if not q or (
                (owner.display_name and q.lower() in owner.display_name.lower())
                or (owner.username and q.lower() in owner.username.lower())
            ):
                users.append(owner)

    # Get user groups
    groups_query = db.query(UserGroup).filter(UserGroup.project_id == project_id)
    if q:
        groups_query = groups_query.filter(UserGroup.name.ilike(f"%{q}%"))
    groups = groups_query.limit(20).all()

    return {
        "users": [
            {
                "id": u.id,
                "display_name": u.display_name,
                "username": u.username,
                "photo_url": u.photo_url,
            }
            for u in users
        ],
        "groups": [{"id": g.id, "name": g.name} for g in groups],
    }
