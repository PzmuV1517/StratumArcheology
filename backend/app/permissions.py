"""
Permission resolution for the file/note system.

This is the single source of truth for "can user U {read|write} node N".
Everything else (route handlers, the History UI, the eMonument bridge,
the watch app's note creation) goes through ``require_perm`` or one of
its lower-level cousins.

# Model

Every ``FileNode`` may or may not be an "ACL root":

* ``is_acl_root = False`` (default): the node inherits its access rules
  from the nearest ancestor that is an ACL root. If no ancestor is an
  ACL root, the project default applies (every project member gets
  read + write).

* ``is_acl_root = True``: the node defines its own access rules in
  ``file_node_acl``. Resolution stops here; if no ACL row matches the
  caller, access is denied.

The denormalised column ``FileNode.acl_root_id`` points at the nearest
ACL-root ancestor (or ``self`` if the node is itself an ACL root). It's
maintained eagerly when ``is_acl_root`` toggles or when a node moves;
the resolver never has to walk the parent chain at request time.

# Override hierarchy

In order of precedence:

1. The project owner can do anything inside their project.
2. The dashboard admin / maintainer can do anything anywhere.
3. The owner of the ACL root has implicit read + write on that root.
4. ACL rows on the ACL root: a row matching the user (directly or via
   group membership) grants ``can_read`` / ``can_write``. Multiple rows
   are OR'd together.
5. If none of the above apply at an ACL root, the answer is "deny".
6. If there is no ACL root in the ancestry, the answer is "allow if
   the caller is a project member".

MIT License - see project root.
"""

from __future__ import annotations

import enum
from dataclasses import dataclass
from typing import Iterable

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import (
    FileNode,
    FileNodeACL,
    Project,
    User,
    UserGroupMember,
    project_members,
)


class PermissionMode(str, enum.Enum):
    READ = "read"
    WRITE = "write"


@dataclass(frozen=True)
class ResolvedPermission:
    """Outcome of a permission check, with the reasoning preserved.

    The fields beyond ``can_read`` / ``can_write`` are diagnostic. They
    drive the 403 responses ("denied because folder X was made private
    by Alice on date Y") and the permissions UI ("inherited from
    folder X").
    """

    can_read: bool
    can_write: bool
    is_owner_override: bool
    is_admin_override: bool
    is_project_default: bool
    is_acl_root_owner: bool
    acl_root_id: str | None
    matched_rows: tuple[str, ...]  # ACL row ids that contributed

    @property
    def allowed(self) -> bool:
        return self.can_read or self.can_write

    def allows(self, mode: PermissionMode) -> bool:
        return self.can_write if mode == PermissionMode.WRITE else self.can_read


def _user_group_ids(db: Session, user_id: str) -> set[str]:
    """Return the set of UserGroup ids the user belongs to.

    Cached on a per-request basis via session.info to avoid running this
    query multiple times during a single listing endpoint.
    """
    cache_key = f"_perm_groups_{user_id}"
    cached = db.info.get(cache_key)
    if cached is not None:
        return cached
    rows = db.execute(
        select(UserGroupMember.group_id).where(UserGroupMember.user_id == user_id)
    ).all()
    group_ids = {r[0] for r in rows if r[0] is not None}
    db.info[cache_key] = group_ids
    return group_ids


def _project_owner_id(db: Session, project_id: str) -> str | None:
    cache_key = f"_perm_owner_{project_id}"
    cached = db.info.get(cache_key, _MISSING)
    if cached is not _MISSING:
        return cached
    owner = db.execute(
        select(Project.owner_id).where(Project.id == project_id)
    ).scalar()
    db.info[cache_key] = owner
    return owner


def _is_project_member(db: Session, project_id: str, user_id: str) -> bool:
    cache_key = f"_perm_member_{project_id}_{user_id}"
    cached = db.info.get(cache_key, _MISSING)
    if cached is not _MISSING:
        return cached
    row = db.execute(
        select(project_members.c.user_id).where(
            project_members.c.project_id == project_id,
            project_members.c.user_id == user_id,
        )
    ).first()
    member = row is not None
    db.info[cache_key] = member
    return member


def _acl_root(db: Session, node: FileNode) -> FileNode | None:
    """Resolve the node's ACL root, falling back to a parent walk if the
    denormalised column is stale (e.g. mid-migration, or a bug in the
    eager updater hasn't caught up yet).

    Returns ``None`` when the node has no ACL root in its ancestry.
    """
    if node.is_acl_root:
        return node
    if node.acl_root_id:
        cached = db.info.get(f"_perm_node_{node.acl_root_id}")
        if cached is not None:
            return cached
        root = db.get(FileNode, node.acl_root_id)
        db.info[f"_perm_node_{node.acl_root_id}"] = root
        return root
    # Slow path: walk up. Only happens if the denorm is stale.
    cur = node
    while cur.parent_id is not None:
        cur = db.get(FileNode, cur.parent_id)
        if cur is None:
            return None
        if cur.is_acl_root:
            return cur
    return None


_MISSING = object()


def resolve_permission(
    db: Session, node: FileNode, user: User
) -> ResolvedPermission:
    """Resolve the user's effective permission on the given file node.

    Pure function over the database state; safe to call from anywhere
    that already has a Session and the user. Use ``require_perm`` from
    a route handler when you want HTTP-friendly enforcement.
    """
    # Precedence rule 2: maintainer / dashboard admin
    if getattr(user, "is_maintainer", False) or getattr(
        user, "is_dashboard_admin", False
    ):
        return ResolvedPermission(
            can_read=True,
            can_write=True,
            is_owner_override=False,
            is_admin_override=True,
            is_project_default=False,
            is_acl_root_owner=False,
            acl_root_id=None,
            matched_rows=(),
        )

    # Precedence rule 1: project owner
    if _project_owner_id(db, node.project_id) == user.id:
        return ResolvedPermission(
            can_read=True,
            can_write=True,
            is_owner_override=True,
            is_admin_override=False,
            is_project_default=False,
            is_acl_root_owner=False,
            acl_root_id=None,
            matched_rows=(),
        )

    # All non-overrides require project membership.
    if not _is_project_member(db, node.project_id, user.id):
        return ResolvedPermission(
            can_read=False,
            can_write=False,
            is_owner_override=False,
            is_admin_override=False,
            is_project_default=False,
            is_acl_root_owner=False,
            acl_root_id=None,
            matched_rows=(),
        )

    root = _acl_root(db, node)
    if root is None:
        # Precedence rule 6: project default - all members get full access
        return ResolvedPermission(
            can_read=True,
            can_write=True,
            is_owner_override=False,
            is_admin_override=False,
            is_project_default=True,
            is_acl_root_owner=False,
            acl_root_id=None,
            matched_rows=(),
        )

    # Precedence rule 3: ACL-root owner has implicit access to their root
    if root.owner_id == user.id:
        return ResolvedPermission(
            can_read=True,
            can_write=True,
            is_owner_override=False,
            is_admin_override=False,
            is_project_default=False,
            is_acl_root_owner=True,
            acl_root_id=root.id,
            matched_rows=(),
        )

    # Precedence rule 4: aggregate matching ACL rows
    group_ids = _user_group_ids(db, user.id)
    rows = (
        db.query(FileNodeACL)
        .filter(FileNodeACL.file_node_id == root.id)
        .filter(
            (FileNodeACL.user_id == user.id)
            | (
                FileNodeACL.group_id.in_(group_ids)
                if group_ids
                else (FileNodeACL.group_id == None)  # noqa: E711
                & (FileNodeACL.user_id == user.id)
            )
        )
        .all()
    )

    can_read = False
    can_write = False
    matched: list[str] = []
    for r in rows:
        if r.user_id == user.id or (r.group_id and r.group_id in group_ids):
            matched.append(r.id)
            if r.can_read:
                can_read = True
            if r.can_write:
                can_write = True
                can_read = True  # write implies read; enforced by DB CHECK too

    return ResolvedPermission(
        can_read=can_read,
        can_write=can_write,
        is_owner_override=False,
        is_admin_override=False,
        is_project_default=False,
        is_acl_root_owner=False,
        acl_root_id=root.id,
        matched_rows=tuple(matched),
    )


def can_read(db: Session, node: FileNode, user: User) -> bool:
    return resolve_permission(db, node, user).can_read


def can_write(db: Session, node: FileNode, user: User) -> bool:
    return resolve_permission(db, node, user).can_write


def filter_readable(
    db: Session, nodes: Iterable[FileNode], user: User
) -> list[FileNode]:
    """Helper for listing endpoints. Returns the subset the user can read."""
    return [n for n in nodes if resolve_permission(db, n, user).can_read]


def assert_perm(
    db: Session,
    node: FileNode,
    user: User,
    mode: PermissionMode,
) -> ResolvedPermission:
    """Resolve permission and raise HTTPException if not granted.

    Returns the resolved permission so the caller can use the metadata
    (e.g. show the diagnostic in a 403 detail).
    """
    perm = resolve_permission(db, node, user)
    if perm.allows(mode):
        return perm
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=_format_denial(perm, mode),
    )


def _format_denial(perm: ResolvedPermission, mode: PermissionMode) -> str:
    """Build a 403 detail string that explains *why* access was denied.

    The frontend can parse the structured ``acl_root_id`` from the
    diagnostics, but a plain English fallback is also useful.
    """
    if perm.acl_root_id:
        verb = "edit" if mode == PermissionMode.WRITE else "read"
        return (
            f"You don't have permission to {verb} this. "
            "Access is restricted by a parent folder's permissions."
        )
    return "You don't have access to this project."


# ---------------------------------------------------------------------------
# FastAPI dependency factory
# ---------------------------------------------------------------------------


def require_perm(mode: PermissionMode):
    """Build a FastAPI dependency that enforces a mode on a path-bound node.

    Usage::

        @router.get(
            "/{node_id}/something",
            dependencies=[Depends(require_perm_on_node(PermissionMode.READ))],
        )
        async def handler(node_id: str, ...):
            ...

    The dependency expects the route to declare a ``node_id`` path param
    of type ``str``. It loads the FileNode, runs ``assert_perm``, and
    returns the FileNode so the handler can reuse it.
    """

    async def _dependency(
        node_id: str,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> FileNode:
        node = db.get(FileNode, node_id)
        if node is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Node not found",
            )
        assert_perm(db, node, current_user, mode)
        return node

    return _dependency


# ---------------------------------------------------------------------------
# ACL maintenance
# ---------------------------------------------------------------------------


def recompute_acl_root_for_subtree(
    db: Session, root_node: FileNode, *, flush: bool = True
) -> None:
    """After ``is_acl_root`` toggles on a node (or after a move), every
    descendant's ``acl_root_id`` may need updating. This walks the
    subtree iteratively and sets the column.

    Uses a fresh sub-session-friendly query so it can be called inside
    an ongoing transaction. Set ``flush=False`` if you'll commit later
    yourself; default is to flush so the caller can rely on the values
    being visible to subsequent queries on the same session.
    """
    new_root_for_root = root_node.id if root_node.is_acl_root else (
        _resolve_root_id_via_walk(db, root_node)
    )
    root_node.acl_root_id = new_root_for_root

    # BFS over descendants; we stop descending into nodes that are
    # themselves ACL roots (their subtree's roots don't change just
    # because an ancestor toggled).
    stack = list(
        db.query(FileNode).filter(FileNode.parent_id == root_node.id).all()
    )
    while stack:
        node = stack.pop()
        if node.is_acl_root:
            # This subtree is anchored at `node`; nothing to update inside.
            node.acl_root_id = node.id
            continue
        node.acl_root_id = new_root_for_root
        children = (
            db.query(FileNode).filter(FileNode.parent_id == node.id).all()
        )
        stack.extend(children)

    if flush:
        db.flush()


def _resolve_root_id_via_walk(db: Session, node: FileNode) -> str | None:
    cur = node
    while cur.parent_id is not None:
        cur = db.get(FileNode, cur.parent_id)
        if cur is None:
            return None
        if cur.is_acl_root:
            return cur.id
    return None
