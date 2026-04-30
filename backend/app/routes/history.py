"""
History (Time Machine) endpoints.

Replaces the legacy ``/files/project/{id}/time-machine`` and
``/projects/{id}/data-versions/{type}`` routes. Reads from the unified
``node_snapshots`` table and supports:

* GET  /history/project/{pid}                          unified timeline
* GET  /history/node/{node_id}                         single-node history
* GET  /history/by-actor/{user_id}/in/{node_id}        scoped audit
* GET  /history/project/{pid}/bin                      recycle bin (7-day TTL)
* POST /history/snapshots/{snapshot_id}/restore        single-snapshot revert
* POST /history/snapshots/restore-batch                multi-select revert
* POST /history/project/{pid}/bin/empty                owner-only purge

MIT License - see project root.
"""

from __future__ import annotations

from datetime import datetime
from typing import Iterable

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import check_project_permission, get_current_user
from app.history import (
    RECYCLE_BIN_TTL,
    decrement_blob_refcount,
    purge_expired_delete_snapshots_async,
    recycle_bin_cutoff,
    record_snapshot,
)
from app.minio_client import minio_client
from app.models import (
    Blob,
    FileNode,
    FileNodeACL,
    FileNodeType,
    NodeSnapshot,
    Project,
    SnapshotKind,
    SnapshotReason,
    User,
)
from app.permissions import (
    PermissionMode,
    assert_perm,
    can_read,
    resolve_permission,
)
from app.schemas import (
    DeletedNodeResponse,
    HistoryTimelineResponse,
    RestoreBatchRequest,
    RestoreRequest,
    SnapshotResponse,
)
from app.websocket import emit_content_update, log_activity

router = APIRouter(prefix="/history", tags=["history"])


# ---------------------------------------------------------------------------
# Serialization helpers
# ---------------------------------------------------------------------------

def _hydrate_actor(db: Session, snapshots: Iterable[NodeSnapshot]) -> dict[str, User]:
    actor_ids = {s.actor_id for s in snapshots if s.actor_id}
    if not actor_ids:
        return {}
    users = db.query(User).filter(User.id.in_(actor_ids)).all()
    return {u.id: u for u in users}


def _serialize(snap: NodeSnapshot, actor: User | None) -> SnapshotResponse:
    return SnapshotResponse(
        id=snap.id,
        project_id=snap.project_id,
        node_id=snap.node_id,
        kind=snap.kind,
        version=snap.version,
        actor_id=snap.actor_id,
        actor_display_name=(actor.display_name if actor else None),
        actor_photo_url=(actor.photo_url if actor else None),
        reason=snap.reason,
        summary=snap.summary,
        created_at=snap.created_at,
        name_at_snapshot=snap.name_at_snapshot,
        path_at_snapshot=snap.path_at_snapshot,
        blob_sha256=snap.blob_sha256,
        is_revertible=_is_revertible(snap),
    )


def _is_revertible(snap: NodeSnapshot) -> bool:
    """Most snapshot kinds support a one-click revert. The exceptions are
    pure ``create`` markers (reverting a create is a delete, which the
    UI offers separately) and ``acl_clear`` (no useful undo besides
    re-applying the prior state, which is the same as a regular ACL
    revert)."""
    if snap.kind == SnapshotKind.CREATE.value:
        return False
    return True


def _filter_visible(
    db: Session, user: User, snapshots: list[NodeSnapshot]
) -> list[NodeSnapshot]:
    """Hide snapshots whose target node the caller can't read.

    For deleted nodes (``node_id`` is NULL after ON DELETE SET NULL), we
    fall back to ``parent_id_at_snapshot`` if present. If the caller is
    project owner or admin, everything is visible.
    """
    if not snapshots:
        return snapshots
    project_id = snapshots[0].project_id
    project = db.get(Project, project_id)
    if (
        project is None
        or project.owner_id == user.id
        or getattr(user, "is_dashboard_admin", False)
        or getattr(user, "is_maintainer", False)
    ):
        return snapshots

    # Pre-fetch nodes referenced by the visible snapshots.
    node_ids = {s.node_id for s in snapshots if s.node_id}
    parent_ids = {
        s.parent_id_at_snapshot for s in snapshots if s.parent_id_at_snapshot
    }
    needed = node_ids | parent_ids
    if not needed:
        return snapshots
    nodes_by_id = {
        n.id: n
        for n in db.query(FileNode).filter(FileNode.id.in_(needed)).all()
    }

    visible: list[NodeSnapshot] = []
    for s in snapshots:
        target = nodes_by_id.get(s.node_id) if s.node_id else None
        if target is None and s.parent_id_at_snapshot:
            target = nodes_by_id.get(s.parent_id_at_snapshot)
        if target is None:
            # Project-level snapshot (Harris/Wheeler) - members can see.
            visible.append(s)
            continue
        if can_read(db, target, user):
            visible.append(s)
    return visible


# ---------------------------------------------------------------------------
# Read endpoints
# ---------------------------------------------------------------------------

@router.get("/project/{project_id}", response_model=HistoryTimelineResponse)
async def project_timeline(
    project_id: str,
    actor_id: str | None = Query(default=None),
    kind: str | None = Query(default=None, description="Filter by snapshot kind"),
    limit: int = Query(default=100, ge=1, le=500),
    before: datetime | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Unified project timeline. Filter by actor, kind, or pagination cursor."""
    check_project_permission(project_id, current_user, db)

    q = (
        db.query(NodeSnapshot)
        .filter(NodeSnapshot.project_id == project_id)
        .order_by(NodeSnapshot.created_at.desc(), NodeSnapshot.id.desc())
    )
    if actor_id:
        q = q.filter(NodeSnapshot.actor_id == actor_id)
    if kind:
        q = q.filter(NodeSnapshot.kind == kind)
    if before:
        q = q.filter(NodeSnapshot.created_at < before)

    rows = q.limit(limit).all()
    rows = _filter_visible(db, current_user, rows)
    actors = _hydrate_actor(db, rows)
    return HistoryTimelineResponse(
        project_id=project_id,
        total=len(rows),
        snapshots=[_serialize(s, actors.get(s.actor_id or "")) for s in rows],
    )


@router.get("/node/{node_id}", response_model=HistoryTimelineResponse)
async def node_timeline(
    node_id: str,
    limit: int = Query(default=100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    node = db.get(FileNode, node_id)
    if node is None:
        raise HTTPException(status_code=404, detail="Node not found")
    assert_perm(db, node, current_user, PermissionMode.READ)

    rows = (
        db.query(NodeSnapshot)
        .filter(NodeSnapshot.node_id == node_id)
        .order_by(NodeSnapshot.created_at.desc(), NodeSnapshot.id.desc())
        .limit(limit)
        .all()
    )
    actors = _hydrate_actor(db, rows)
    return HistoryTimelineResponse(
        project_id=node.project_id,
        total=len(rows),
        snapshots=[_serialize(s, actors.get(s.actor_id or "")) for s in rows],
    )


@router.get(
    "/by-actor/{user_id}/in/{node_id}",
    response_model=HistoryTimelineResponse,
)
async def by_actor_in_node(
    user_id: str,
    node_id: str,
    limit: int = Query(default=200, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Show what ``user_id`` did inside ``node_id`` (and any descendant)
    that the caller is allowed to see.

    Implemented via a parent-chain walk on ``acl_root_id`` and
    ``parent_id`` rather than path matching, so renames don't break it.
    """
    node = db.get(FileNode, node_id)
    if node is None:
        raise HTTPException(status_code=404, detail="Node not found")
    assert_perm(db, node, current_user, PermissionMode.READ)

    # Collect the descendant set with a BFS. Folders only have child
    # FileNodes; we don't care about node_snapshots whose node was
    # deleted because those are recoverable via the bin endpoint.
    descendants: set[str] = {node.id}
    frontier = [node.id]
    while frontier:
        kids = (
            db.query(FileNode.id)
            .filter(FileNode.parent_id.in_(frontier))
            .all()
        )
        next_frontier = [k.id for k in kids if k.id not in descendants]
        descendants.update(next_frontier)
        frontier = next_frontier

    rows = (
        db.query(NodeSnapshot)
        .filter(
            NodeSnapshot.project_id == node.project_id,
            NodeSnapshot.actor_id == user_id,
            or_(
                NodeSnapshot.node_id.in_(descendants),
                NodeSnapshot.parent_id_at_snapshot.in_(descendants),
            ),
        )
        .order_by(NodeSnapshot.created_at.desc(), NodeSnapshot.id.desc())
        .limit(limit)
        .all()
    )
    rows = _filter_visible(db, current_user, rows)
    actors = _hydrate_actor(db, rows)
    return HistoryTimelineResponse(
        project_id=node.project_id,
        total=len(rows),
        snapshots=[_serialize(s, actors.get(s.actor_id or "")) for s in rows],
    )


@router.get("/project/{project_id}/bin", response_model=list[DeletedNodeResponse])
async def list_recycle_bin(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Recoverable deletions, freshest first. Items live for 7 days.

    Hidden if the caller couldn't have read the deleted node when it
    existed. The owner sees everything.
    """
    check_project_permission(project_id, current_user, db)

    # Opportunistic GC: cheap and keeps the bin clean.
    await purge_expired_delete_snapshots_async(db)
    db.commit()

    cutoff = recycle_bin_cutoff()
    rows = (
        db.query(NodeSnapshot)
        .filter(
            NodeSnapshot.project_id == project_id,
            NodeSnapshot.kind == SnapshotKind.DELETE.value,
            NodeSnapshot.created_at >= cutoff,
        )
        .order_by(NodeSnapshot.created_at.desc())
        .all()
    )
    rows = _filter_visible(db, current_user, rows)
    actors = _hydrate_actor(db, rows)

    out: list[DeletedNodeResponse] = []
    for s in rows:
        actor = actors.get(s.actor_id or "")
        payload = s.payload or {}
        out.append(
            DeletedNodeResponse(
                snapshot_id=s.id,
                node_id=s.node_id,
                name=s.name_at_snapshot or payload.get("name") or "(unnamed)",
                type=str(payload.get("type") or "file"),
                parent_id_at_snapshot=s.parent_id_at_snapshot,
                path_at_snapshot=s.path_at_snapshot,
                deleted_at=s.created_at,
                deleted_by_id=s.actor_id,
                deleted_by_display_name=(actor.display_name if actor else None),
                expires_at=s.created_at + RECYCLE_BIN_TTL,
            )
        )
    return out


# ---------------------------------------------------------------------------
# Restore endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/snapshots/{snapshot_id}/restore", response_model=SnapshotResponse
)
async def restore_snapshot(
    snapshot_id: str,
    body: RestoreRequest = RestoreRequest(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Restore a single snapshot.

    The semantics depend on the snapshot's ``kind``:

    * ``file_content`` / ``note_content`` / ``folder_metadata``:
      replace the live node's content/metadata with the snapshot's,
      then write a new ``restore`` snapshot.
    * ``delete``: re-create the node from the saved payload + blob,
      restoring it to its prior parent if that still exists, otherwise
      to the project root.
    * ``acl_change``: replay the ACL state recorded at this snapshot.
    * ``harris_matrix`` / ``wheeler``: write the saved payload back to
      the project's JSON column.
    """
    snap = db.get(NodeSnapshot, snapshot_id)
    if snap is None:
        raise HTTPException(status_code=404, detail="Snapshot not found")

    project = db.get(Project, snap.project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    is_owner = project.owner_id == current_user.id

    if snap.kind == SnapshotKind.DELETE.value:
        return await _restore_delete(db, snap, current_user, force=body.force)

    if snap.node_id:
        node = db.get(FileNode, snap.node_id)
        if node is None:
            raise HTTPException(
                status_code=410,
                detail="Underlying node is gone. Restore via the recycle bin instead.",
            )
        # Restoring requires write on the node. ACL revert additionally
        # requires that the caller owns the node or owns the project,
        # because changing perms is a sensitive operation.
        if snap.kind == SnapshotKind.ACL_CHANGE.value:
            if node.owner_id != current_user.id and not is_owner:
                raise HTTPException(
                    status_code=403,
                    detail="Only the node owner or project leader can revert permission changes.",
                )
        else:
            assert_perm(db, node, current_user, PermissionMode.WRITE)

    new_snap = await _apply_restore(db, snap, current_user)
    db.commit()
    await emit_content_update(snap.project_id, "files")
    return _serialize(new_snap, current_user)


@router.post("/snapshots/restore-batch")
async def restore_snapshots_batch(
    body: RestoreBatchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Restore many snapshots in one call. Used by the History UI's
    'Revert selected' button.

    Failures are reported per-snapshot so a partial batch still applies
    everything it can.
    """
    results: list[dict] = []
    for sid in body.snapshot_ids:
        snap = db.get(NodeSnapshot, sid)
        if snap is None:
            results.append({"snapshot_id": sid, "ok": False, "error": "not found"})
            continue

        project = db.get(Project, snap.project_id)
        if project is None:
            results.append({"snapshot_id": sid, "ok": False, "error": "no project"})
            continue
        is_owner = project.owner_id == current_user.id

        try:
            if snap.kind == SnapshotKind.DELETE.value:
                await _restore_delete(db, snap, current_user, force=body.force)
            else:
                if snap.node_id:
                    node = db.get(FileNode, snap.node_id)
                    if node is None:
                        raise HTTPException(
                            status_code=410, detail="Node is gone"
                        )
                    if snap.kind == SnapshotKind.ACL_CHANGE.value:
                        if node.owner_id != current_user.id and not is_owner:
                            raise HTTPException(
                                status_code=403,
                                detail="Only the node owner or project leader can revert permission changes.",
                            )
                    else:
                        assert_perm(db, node, current_user, PermissionMode.WRITE)
                await _apply_restore(db, snap, current_user)
            results.append({"snapshot_id": sid, "ok": True})
        except HTTPException as e:
            results.append(
                {"snapshot_id": sid, "ok": False, "error": e.detail}
            )
    db.commit()
    if results and any(r["ok"] for r in results):
        # Pick any project_id from a successful row for the WS notify
        sids = [r["snapshot_id"] for r in results if r["ok"]]
        if sids:
            sample = db.get(NodeSnapshot, sids[0])
            if sample is not None:
                await emit_content_update(sample.project_id, "files")
    return {"results": results}


@router.post("/project/{project_id}/bin/empty")
async def empty_recycle_bin(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Owner-only: permanently purge every entry in the recycle bin
    *now*, without waiting for the 7-day TTL. The action is logged via
    an activity row + a synthetic ``ACL_CLEAR``-style snapshot so the
    timeline reflects it.
    """
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.owner_id != current_user.id and not getattr(
        current_user, "is_dashboard_admin", False
    ):
        raise HTTPException(
            status_code=403,
            detail="Only the project owner can empty the recycle bin.",
        )

    rows = (
        db.query(NodeSnapshot)
        .filter(
            NodeSnapshot.project_id == project_id,
            NodeSnapshot.kind == SnapshotKind.DELETE.value,
        )
        .all()
    )
    purged = 0
    for snap in rows:
        payload = snap.payload or {}
        storage_path = payload.get("storage_path")
        if storage_path:
            await minio_client.delete_file(storage_path)
        if snap.blob_sha256:
            decrement_blob_refcount(db, snap.blob_sha256)
        db.delete(snap)
        purged += 1

    # Audit trail: a synthetic snapshot pinning who emptied the bin.
    record_snapshot(
        db,
        project_id=project_id,
        node=None,
        kind=SnapshotKind.DELETE,
        reason=SnapshotReason.SYSTEM_MIGRATE,
        actor_id=current_user.id,
        payload={"action": "empty_recycle_bin", "purged_count": purged},
        summary=f"Emptied the recycle bin ({purged} item(s) removed permanently)",
    )

    db.commit()

    await log_activity(
        db=db,
        project_id=project_id,
        activity_type="FILE_DELETED",
        description=f"Emptied the recycle bin ({purged} item(s) permanently removed)",
        user_id=current_user.id,
        metadata={"purged_count": purged},
    )
    await emit_content_update(project_id, "files")

    return {"purged_count": purged}


# ---------------------------------------------------------------------------
# Internal restore mechanics
# ---------------------------------------------------------------------------

async def _apply_restore(
    db: Session, snap: NodeSnapshot, actor: User
) -> NodeSnapshot:
    """Perform the actual mutation that "rewinds" a snapshot. Writes a
    new ``restore`` snapshot at the end so the History UI shows the
    restoration too."""
    if snap.kind == SnapshotKind.FILE_CONTENT.value:
        return await _restore_file_content(db, snap, actor)
    if snap.kind == SnapshotKind.NOTE_CONTENT.value:
        return _restore_note_content(db, snap, actor)
    if snap.kind == SnapshotKind.FOLDER_METADATA.value:
        return _restore_folder_metadata(db, snap, actor)
    if snap.kind == SnapshotKind.ACL_CHANGE.value:
        return _restore_acl_state(db, snap, actor)
    if snap.kind in (SnapshotKind.HARRIS_MATRIX.value, SnapshotKind.WHEELER.value):
        return _restore_project_data(db, snap, actor)
    raise HTTPException(
        status_code=400, detail=f"Cannot restore snapshot of kind {snap.kind}"
    )


async def _restore_file_content(
    db: Session, snap: NodeSnapshot, actor: User
) -> NodeSnapshot:
    if snap.node_id is None:
        raise HTTPException(status_code=410, detail="Target node is gone")
    node = db.get(FileNode, snap.node_id)
    if node is None:
        raise HTTPException(status_code=410, detail="Target node is gone")

    blob = db.get(Blob, snap.blob_sha256) if snap.blob_sha256 else None
    if blob is None and snap.payload and snap.payload.get("legacy_storage_path"):
        # Legacy import - read the original storage path back into a blob.
        legacy = snap.payload["legacy_storage_path"]
        data = await minio_client.get_file(legacy)
        if data is None:
            raise HTTPException(
                status_code=410, detail="Legacy version data is gone"
            )
        from app.history import ensure_blob, sha256_of  # local import

        blob = await ensure_blob(db, data, mime_type=node.mime_type)
        snap.blob_sha256 = blob.sha256

    if blob is None:
        raise HTTPException(
            status_code=410, detail="No blob for this snapshot"
        )

    # Snapshot the *current* state before we overwrite it, so the
    # restore is itself revertible.
    if node.storage_path:
        live_data = await minio_client.get_file(node.storage_path)
        if live_data is not None:
            from app.history import ensure_blob, increment_blob_refcount

            current_blob = await ensure_blob(
                db, live_data, mime_type=node.mime_type
            )
            increment_blob_refcount(db, current_blob.sha256)
            record_snapshot(
                db,
                project_id=node.project_id,
                node=node,
                kind=SnapshotKind.FILE_CONTENT,
                reason=SnapshotReason.RESTORE,
                actor_id=actor.id,
                blob_sha256=current_blob.sha256,
                summary=f"Captured pre-restore state of \"{node.name}\"",
            )

    # Copy the snapshot's bytes onto the live node's storage path.
    blob_bytes = await minio_client.get_file(blob.storage_path)
    if blob_bytes is None:
        raise HTTPException(status_code=500, detail="Blob storage missing")
    if not node.storage_path:
        node.storage_path = f"files/{node.project_id}/{node.id}"
    await minio_client.upload_file(
        blob_bytes, node.storage_path, node.mime_type or "application/octet-stream"
    )
    node.size = str(blob.size)
    node.checksum = blob.sha256
    node.version = (node.version or 0) + 1
    node.updated_at = datetime.utcnow()

    return record_snapshot(
        db,
        project_id=node.project_id,
        node=node,
        kind=SnapshotKind.FILE_CONTENT,
        reason=SnapshotReason.RESTORE,
        actor_id=actor.id,
        blob_sha256=blob.sha256,
        summary=f"Restored \"{node.name}\" to v{snap.version}",
    )


def _restore_note_content(
    db: Session, snap: NodeSnapshot, actor: User
) -> NodeSnapshot:
    from app.models import Note, NoteFileLink

    if snap.node_id is None:
        raise HTTPException(status_code=410, detail="Target note is gone")
    node = db.get(FileNode, snap.node_id)
    if node is None:
        raise HTTPException(status_code=410, detail="Target note is gone")

    payload = snap.payload or {}
    title = payload.get("title")
    content = payload.get("content")

    link = (
        db.query(NoteFileLink)
        .filter(NoteFileLink.file_node_id == node.id)
        .first()
    )
    if link is None or link.note is None:
        raise HTTPException(status_code=410, detail="Linked note row is gone")

    note: Note = link.note
    if title is not None:
        note.title = title
    if content is not None:
        note.content = content
    note.updated_at = datetime.utcnow()
    note.version = (note.version or 0) + 1

    return record_snapshot(
        db,
        project_id=node.project_id,
        node=node,
        kind=SnapshotKind.NOTE_CONTENT,
        reason=SnapshotReason.RESTORE,
        actor_id=actor.id,
        payload={"title": note.title, "content": note.content},
        summary=f"Restored note \"{note.title}\" to v{snap.version}",
    )


def _restore_folder_metadata(
    db: Session, snap: NodeSnapshot, actor: User
) -> NodeSnapshot:
    if snap.node_id is None:
        raise HTTPException(status_code=410, detail="Target node is gone")
    node = db.get(FileNode, snap.node_id)
    if node is None:
        raise HTTPException(status_code=410, detail="Target node is gone")

    payload = snap.payload or {}
    new_name = payload.get("name") or node.name
    new_parent = payload.get("parent_id") or node.parent_id

    node.name = new_name
    node.parent_id = new_parent
    node.updated_at = datetime.utcnow()

    return record_snapshot(
        db,
        project_id=node.project_id,
        node=node,
        kind=SnapshotKind.FOLDER_METADATA,
        reason=SnapshotReason.RESTORE,
        actor_id=actor.id,
        payload={"name": node.name, "parent_id": node.parent_id},
        summary=f"Restored \"{node.name}\" structure to v{snap.version}",
    )


def _restore_acl_state(
    db: Session, snap: NodeSnapshot, actor: User
) -> NodeSnapshot:
    if snap.node_id is None:
        raise HTTPException(status_code=410, detail="Target node is gone")
    node = db.get(FileNode, snap.node_id)
    if node is None:
        raise HTTPException(status_code=410, detail="Target node is gone")

    desired = snap.acl_state_at_snapshot or []

    db.query(FileNodeACL).filter(FileNodeACL.file_node_id == node.id).delete(
        synchronize_session=False
    )
    for entry in desired:
        db.add(
            FileNodeACL(
                file_node_id=node.id,
                user_id=entry.get("user_id"),
                group_id=entry.get("group_id"),
                can_read=bool(entry.get("can_read", True)),
                can_write=bool(entry.get("can_write", False)),
                inherited_from_node_id=entry.get("inherited_from_node_id"),
                created_by=actor.id,
            )
        )
    node.updated_at = datetime.utcnow()
    db.flush()

    from app.history import record_acl_change

    return record_acl_change(
        db,
        node=node,
        actor_id=actor.id,
        reason=SnapshotReason.RESTORE,
        summary=f"Restored permissions for \"{node.name}\" to v{snap.version}",
    )


def _restore_project_data(
    db: Session, snap: NodeSnapshot, actor: User
) -> NodeSnapshot:
    project = db.get(Project, snap.project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    if snap.kind == SnapshotKind.HARRIS_MATRIX.value:
        project.harris_matrix_data = snap.payload
        project.harris_matrix_version = (project.harris_matrix_version or 0) + 1
    else:
        project.wheeler_data = snap.payload
        project.wheeler_data_version = (project.wheeler_data_version or 0) + 1

    return record_snapshot(
        db,
        project_id=project.id,
        node=None,
        kind=SnapshotKind(snap.kind),
        reason=SnapshotReason.RESTORE,
        actor_id=actor.id,
        payload=snap.payload,
        summary=f"Restored {snap.kind} to v{snap.version}",
    )


async def _restore_delete(
    db: Session,
    snap: NodeSnapshot,
    actor: User,
    *,
    force: bool,
) -> SnapshotResponse:
    if snap.kind != SnapshotKind.DELETE.value:
        raise HTTPException(
            status_code=400,
            detail="This snapshot is not a deletion. Use the regular restore.",
        )
    if snap.created_at < recycle_bin_cutoff():
        raise HTTPException(
            status_code=410,
            detail="This deletion has expired (older than 7 days) and cannot be recovered.",
        )

    payload = snap.payload or {}
    name = snap.name_at_snapshot or payload.get("name") or "Recovered item"
    node_type = payload.get("type") or FileNodeType.FILE.value
    parent_id = snap.parent_id_at_snapshot

    # If the original parent is gone, we drop the recovered node at
    # the project root rather than refusing.
    if parent_id and db.get(FileNode, parent_id) is None:
        parent_id = None

    new_node = FileNode(
        project_id=snap.project_id,
        parent_id=parent_id,
        name=name,
        type=FileNodeType(node_type),
        owner_id=payload.get("owner_id"),
        mime_type=payload.get("mime_type"),
        size=payload.get("size"),
        is_acl_root=bool(payload.get("is_acl_root")),
    )

    # Restore the binary content if there was any.
    if payload.get("storage_path"):
        # Try the original storage path first, then any blob the snap
        # might have been linked to.
        data = await minio_client.get_file(payload["storage_path"])
        if data is None and snap.blob_sha256:
            blob = db.get(Blob, snap.blob_sha256)
            if blob:
                data = await minio_client.get_file(blob.storage_path)
        if data is not None:
            new_node.storage_path = (
                f"files/{snap.project_id}/{new_node.id or 'restored'}"
            )

    db.add(new_node)
    db.flush()

    note_payload = payload.get("note") if isinstance(payload, dict) else None
    if note_payload:
        from app.models import Note, NoteFileLink

        note_id = note_payload.get("id") or note_payload.get("note_id")
        note = db.get(Note, note_id) if note_id else None
        if note is None:
            note = Note(
                id=note_id,
                title=note_payload.get("title") or name,
                content=note_payload.get("content") or "",
                project_id=snap.project_id,
                author_id=note_payload.get("author_id") or actor.id,
            )
            note.created_at = note_payload.get("created_at") or datetime.utcnow()
            note.updated_at = note_payload.get("updated_at") or datetime.utcnow()
            note.version = int(note_payload.get("version") or 1)
            note.transcription = note_payload.get("transcription")
            note.transcription_original = note_payload.get("transcription_original")
            note.transcription_modified = bool(
                note_payload.get("transcription_modified") or False
            )
            note.transcription_status = note_payload.get("transcription_status")
            db.add(note)
        else:
            note.title = note_payload.get("title") or note.title
            note.content = note_payload.get("content") or note.content
            note.updated_at = datetime.utcnow()
            note.transcription = note_payload.get("transcription")
            note.transcription_original = note_payload.get("transcription_original")
            note.transcription_modified = bool(
                note_payload.get("transcription_modified") or False
            )
            note.transcription_status = note_payload.get("transcription_status")

        db.flush()

        existing_link = (
            db.query(NoteFileLink)
            .filter(NoteFileLink.note_id == note.id)
            .first()
        )
        if existing_link:
            existing_link.file_node_id = new_node.id
        else:
            db.add(NoteFileLink(note_id=note.id, file_node_id=new_node.id))

    if payload.get("storage_path") and new_node.storage_path:
        data = await minio_client.get_file(payload["storage_path"])
        if data is None and snap.blob_sha256:
            blob = db.get(Blob, snap.blob_sha256)
            if blob:
                data = await minio_client.get_file(blob.storage_path)
        if data is not None:
            await minio_client.upload_file(
                data,
                new_node.storage_path,
                new_node.mime_type or "application/octet-stream",
            )
            new_node.size = str(len(data))

    # Wire up the recycle bin: the delete snapshot is consumed.
    db.delete(snap)
    db.flush()

    record_snapshot(
        db,
        project_id=snap.project_id,
        node=new_node,
        kind=SnapshotKind.CREATE,
        reason=SnapshotReason.RESTORE,
        actor_id=actor.id,
        summary=f"Recovered \"{name}\" from the recycle bin",
    )

    await log_activity(
        db=db,
        project_id=snap.project_id,
        activity_type="FILE_UPLOADED",
        description=f'Recovered "{name}" from the recycle bin',
        user_id=actor.id,
        metadata={"node_id": new_node.id, "name": name, "force": force},
    )

    return SnapshotResponse(
        id=snap.id,
        project_id=snap.project_id,
        node_id=new_node.id,
        kind=SnapshotKind.CREATE.value,
        version=1,
        actor_id=actor.id,
        actor_display_name=actor.display_name,
        actor_photo_url=actor.photo_url,
        reason=SnapshotReason.RESTORE.value,
        summary=f"Recovered \"{name}\"",
        created_at=datetime.utcnow(),
        name_at_snapshot=name,
        path_at_snapshot=snap.path_at_snapshot,
        blob_sha256=snap.blob_sha256,
        is_revertible=False,
    )
