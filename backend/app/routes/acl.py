"""
ACL management endpoints for file/folder/note nodes.

These replace the legacy ``/files/.../my-folder/permissions`` and
``/files/.../privacy`` endpoints with a generic, per-node permission
model.

* GET    /acl/{node_id}            view effective ACL + inheritance trace
* PUT    /acl/{node_id}            replace ACL (turns node into acl-root)
* DELETE /acl/{node_id}            clear ACL (re-inherit from parent)
* POST   /acl/{node_id}/share      add or update one principal

Who can change an ACL:

* the **project owner** can edit any node's ACL anywhere in the project
* a **node owner** can edit ACLs on nodes they own (typically their
  personal folder + descendants they created)

Everyone else gets 403, regardless of whether they have write access
to the file. Editing the contents and editing who-can-see-it are
deliberately split.

MIT License - see project root.
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.history import record_acl_change
from app.models import (
    FileNode,
    FileNodeACL,
    Project,
    SnapshotReason,
    User,
    UserGroup,
    project_members,
)
from app.permissions import (
    recompute_acl_root_for_subtree,
    resolve_permission,
)
from app.schemas import (
    ACLPrincipalEntry,
    ACLPutRequest,
    ACLShareRequest,
    ACLState,
)
from app.websocket import emit_content_update, log_activity

router = APIRouter(prefix="/acl", tags=["acl"])


def _ensure_can_manage_acl(db: Session, node: FileNode, user: User) -> Project:
    """Authorization gate. Returns the project so the caller can use it."""
    project = db.get(Project, node.project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    if (
        project.owner_id == user.id
        or node.owner_id == user.id
        or getattr(user, "is_dashboard_admin", False)
        or getattr(user, "is_maintainer", False)
    ):
        return project
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Only the project owner or the node owner can change permissions.",
    )


def _serialize_entries(
    db: Session, project_id: str, rows: list[FileNodeACL]
) -> list[ACLPrincipalEntry]:
    """Decorate ACL rows with display names so the UI can avoid a join."""
    user_ids = {r.user_id for r in rows if r.user_id}
    group_ids = {r.group_id for r in rows if r.group_id}
    users = (
        {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()}
        if user_ids
        else {}
    )
    groups = (
        {
            g.id: g
            for g in db.query(UserGroup)
            .filter(UserGroup.id.in_(group_ids))
            .all()
        }
        if group_ids
        else {}
    )

    member_roles: dict[str, str] = {}
    if user_ids:
        rows_q = db.execute(
            project_members.select().where(
                project_members.c.project_id == project_id,
                project_members.c.user_id.in_(user_ids),
            )
        )
        for row in rows_q.fetchall():
            role = getattr(row, "role", None)
            member_roles[row.user_id] = (
                role.value if role and hasattr(role, "value") else str(role or "")
            )

    out: list[ACLPrincipalEntry] = []
    for r in rows:
        u = users.get(r.user_id) if r.user_id else None
        g = groups.get(r.group_id) if r.group_id else None
        out.append(
            ACLPrincipalEntry(
                user_id=r.user_id,
                group_id=r.group_id,
                can_read=r.can_read,
                can_write=r.can_write,
                inherited_from_node_id=r.inherited_from_node_id,
                display_name=(
                    (u.display_name or u.email) if u else (g.name if g else None)
                ),
                photo_url=(u.photo_url if u else None),
                role=member_roles.get(r.user_id) if r.user_id else None,
            )
        )
    return out


@router.get("/{node_id}", response_model=ACLState)
async def get_acl(
    node_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Read the ACL state of a node. Anyone with read access on the
    node can read its ACL (so they can see *who else* has access).
    """
    node = db.get(FileNode, node_id)
    if node is None:
        raise HTTPException(status_code=404, detail="Node not found")

    perm = resolve_permission(db, node, current_user)
    if not perm.can_read:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this node.",
        )

    # If this node isn't an acl-root, surface the inheritance source
    # instead of an empty entry list.
    if not node.is_acl_root and node.acl_root_id:
        ancestor = db.get(FileNode, node.acl_root_id)
        if ancestor is not None:
            rows = (
                db.query(FileNodeACL)
                .filter(FileNodeACL.file_node_id == ancestor.id)
                .all()
            )
            return ACLState(
                file_node_id=node.id,
                is_acl_root=False,
                inherits_from=ancestor.id,
                entries=_serialize_entries(db, node.project_id, rows),
            )

    rows = (
        db.query(FileNodeACL)
        .filter(FileNodeACL.file_node_id == node.id)
        .all()
    )
    return ACLState(
        file_node_id=node.id,
        is_acl_root=node.is_acl_root,
        inherits_from=None,
        entries=_serialize_entries(db, node.project_id, rows),
    )


@router.put("/{node_id}", response_model=ACLState)
async def put_acl(
    node_id: str,
    body: ACLPutRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Replace the ACL for a node. ``is_acl_root=True`` makes this
    node govern its descendants; ``is_acl_root=False`` clears any
    rules and re-inherits from the parent.
    """
    node = db.get(FileNode, node_id)
    if node is None:
        raise HTTPException(status_code=404, detail="Node not found")

    project = _ensure_can_manage_acl(db, node, current_user)

    # Validate and normalise entries upfront.
    if not body.is_acl_root and body.entries:
        raise HTTPException(
            status_code=400,
            detail="Cannot specify entries when is_acl_root is False.",
        )
    cleaned: list[ACLPrincipalEntry] = []
    seen: set[tuple[str | None, str | None]] = set()
    for entry in body.entries:
        if (entry.user_id is None) == (entry.group_id is None):
            raise HTTPException(
                status_code=400,
                detail="Each ACL entry must reference exactly one of user_id or group_id.",
            )
        # Write implies read.
        can_read = bool(entry.can_read or entry.can_write)
        can_write = bool(entry.can_write)
        key = (entry.user_id, entry.group_id)
        if key in seen:
            raise HTTPException(
                status_code=400,
                detail="Duplicate ACL entry for the same principal.",
            )
        seen.add(key)
        cleaned.append(
            ACLPrincipalEntry(
                user_id=entry.user_id,
                group_id=entry.group_id,
                can_read=can_read,
                can_write=can_write,
            )
        )

    # Wipe any existing rules, then write the new ones.
    db.query(FileNodeACL).filter(FileNodeACL.file_node_id == node.id).delete(
        synchronize_session=False
    )
    for entry in cleaned:
        db.add(
            FileNodeACL(
                file_node_id=node.id,
                user_id=entry.user_id,
                group_id=entry.group_id,
                can_read=entry.can_read,
                can_write=entry.can_write,
                created_by=current_user.id,
            )
        )

    was_acl_root = node.is_acl_root
    node.is_acl_root = body.is_acl_root
    node.updated_at = datetime.utcnow()

    # If this is the first time the node becomes an acl-root, point
    # acl_root_id at itself; if it was an acl-root and is now off,
    # walk up to find the new effective root.
    if body.is_acl_root and not was_acl_root:
        # Subtree below this node now anchors here.
        recompute_acl_root_for_subtree(db, node)
    elif was_acl_root and not body.is_acl_root:
        recompute_acl_root_for_subtree(db, node)
    elif body.is_acl_root and was_acl_root:
        # No change in scope; just make sure self points at self.
        node.acl_root_id = node.id

    record_acl_change(
        db,
        node=node,
        actor_id=current_user.id,
        reason=(
            SnapshotReason.ACL_GRANT
            if body.is_acl_root and cleaned
            else SnapshotReason.ACL_CLEAR
        ),
        summary=(
            f'Set permissions on "{node.name}" '
            f"({len(cleaned)} principal{'s' if len(cleaned) != 1 else ''})"
            if body.is_acl_root
            else f'Cleared permissions on "{node.name}" (re-inherits from parent)'
        ),
    )
    db.commit()

    await log_activity(
        db=db,
        project_id=project.id,
        activity_type="FILE_UPDATED",
        description=f'Updated permissions on "{node.name}"',
        user_id=current_user.id,
        metadata={
            "node_id": node.id,
            "is_acl_root": node.is_acl_root,
            "principal_count": len(cleaned),
        },
    )
    await emit_content_update(project.id, "files")

    return await get_acl(node_id, current_user=current_user, db=db)


@router.delete("/{node_id}", response_model=ACLState)
async def clear_acl(
    node_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Sugar for ``PUT`` with ``is_acl_root=False`` and no entries."""
    body = ACLPutRequest(is_acl_root=False, entries=[])
    return await put_acl(
        node_id, body=body, current_user=current_user, db=db
    )


@router.post("/{node_id}/share", response_model=ACLState)
async def share_with_principal(
    node_id: str,
    body: ACLShareRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add or update a single principal on a node, marking the node
    as ``is_acl_root`` if it isn't already.

    Convenience wrapper over PUT for the "Share..." button in the UI.
    """
    if (body.user_id is None) == (body.group_id is None):
        raise HTTPException(
            status_code=400,
            detail="Provide exactly one of user_id or group_id.",
        )

    node = db.get(FileNode, node_id)
    if node is None:
        raise HTTPException(status_code=404, detail="Node not found")
    project = _ensure_can_manage_acl(db, node, current_user)

    # Pull the existing entries (from this node only - sharing on an
    # inheriting node turns it into its own acl-root, copying the
    # ancestor's entries first so behaviour stays predictable).
    if not node.is_acl_root and node.acl_root_id and node.acl_root_id != node.id:
        ancestor_rows = (
            db.query(FileNodeACL)
            .filter(FileNodeACL.file_node_id == node.acl_root_id)
            .all()
        )
        for r in ancestor_rows:
            db.add(
                FileNodeACL(
                    file_node_id=node.id,
                    user_id=r.user_id,
                    group_id=r.group_id,
                    can_read=r.can_read,
                    can_write=r.can_write,
                    inherited_from_node_id=node.acl_root_id,
                    created_by=current_user.id,
                )
            )

    existing = (
        db.query(FileNodeACL)
        .filter(
            FileNodeACL.file_node_id == node.id,
            (FileNodeACL.user_id == body.user_id)
            if body.user_id
            else (FileNodeACL.group_id == body.group_id),
        )
        .first()
    )
    if existing is not None:
        existing.can_read = bool(body.can_read or body.can_write)
        existing.can_write = bool(body.can_write)
    else:
        db.add(
            FileNodeACL(
                file_node_id=node.id,
                user_id=body.user_id,
                group_id=body.group_id,
                can_read=bool(body.can_read or body.can_write),
                can_write=bool(body.can_write),
                created_by=current_user.id,
            )
        )

    if not node.is_acl_root:
        node.is_acl_root = True
        recompute_acl_root_for_subtree(db, node)

    node.updated_at = datetime.utcnow()

    record_acl_change(
        db,
        node=node,
        actor_id=current_user.id,
        reason=SnapshotReason.ACL_GRANT,
        summary=(
            f'Shared "{node.name}" with '
            f"{'a user' if body.user_id else 'a group'}"
        ),
    )
    db.commit()

    await log_activity(
        db=db,
        project_id=project.id,
        activity_type="FILE_UPDATED",
        description=f'Shared "{node.name}" with another principal',
        user_id=current_user.id,
        metadata={
            "node_id": node.id,
            "user_id": body.user_id,
            "group_id": body.group_id,
            "can_write": bool(body.can_write),
        },
    )
    await emit_content_update(project.id, "files")

    return await get_acl(node_id, current_user=current_user, db=db)
