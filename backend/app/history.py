"""
Snapshot recording and content-addressed blob storage.

Every mutation in the file/note/project-data world goes through one of
the ``record_*`` helpers in this module. They:

* compute the new monotonic version number for the (node, kind) pair,
* write a ``NodeSnapshot`` row capturing what changed and who did it,
* for binary content, hash and upload the blob exactly once (dedup) and
  bump its ``ref_count``.

The History UI reads from ``NodeSnapshot``; restoring is a matter of
finding the right snapshot and either copying its blob into the live
node or replacing the live node's payload.

The ``Blob`` table is content-addressed by SHA-256. Multiple file nodes
or snapshots can reference the same blob; ``ref_count`` tracks how many.
A periodic GC sweep is responsible for purging blobs whose ref_count
drops to zero.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.minio_client import minio_client
from app.models import (
    Blob,
    FileNode,
    FileNodeACL,
    NodeSnapshot,
    SnapshotKind,
    SnapshotReason,
)


# ---------------------------------------------------------------------------
# Path utilities
# ---------------------------------------------------------------------------

def compute_path(db: Session, node: FileNode) -> str:
    """Return a slash-delimited path for a node, walking up the tree.

    Used to populate ``path_at_snapshot`` so that deleted nodes can be
    restored to a recognisable location even after their ancestors are
    gone too. Cached on the session.
    """
    cache_key = f"_path_{node.id}"
    if cache_key in db.info:
        return db.info[cache_key]

    parts: list[str] = []
    current: FileNode | None = node
    safety = 0
    while current is not None and safety < 256:
        parts.append(current.name or "")
        if current.parent_id is None:
            break
        current = db.get(FileNode, current.parent_id)
        safety += 1

    path = "/" + "/".join(reversed(parts))
    db.info[cache_key] = path
    return path


# ---------------------------------------------------------------------------
# Blob storage with SHA-256 dedup
# ---------------------------------------------------------------------------

def sha256_of(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _blob_storage_key(sha256: str) -> str:
    """Place blobs at ``blobs/<aa>/<bb>/<full-hash>`` to keep MinIO dirs
    shallow on browsers."""
    return f"blobs/{sha256[:2]}/{sha256[2:4]}/{sha256}"


async def ensure_blob(
    db: Session,
    data: bytes,
    *,
    mime_type: str | None = None,
) -> Blob:
    """Upload ``data`` to object storage exactly once, regardless of how
    many times this function is called with the same bytes.

    Returns the ``Blob`` row, with ``ref_count`` *not* yet incremented.
    The caller is responsible for incrementing once they've persisted
    the reference (so we don't leak ref_count if the caller's
    transaction rolls back).
    """
    digest = sha256_of(data)
    existing = db.get(Blob, digest)
    if existing is not None:
        return existing

    storage_path = _blob_storage_key(digest)
    await minio_client.upload_file(
        data, storage_path, mime_type or "application/octet-stream"
    )

    blob = Blob(
        sha256=digest,
        size=len(data),
        storage_path=storage_path,
        mime_type=mime_type,
        ref_count=0,
    )
    db.add(blob)
    db.flush()
    return blob


def increment_blob_refcount(db: Session, sha256: str) -> None:
    db.query(Blob).filter(Blob.sha256 == sha256).update(
        {Blob.ref_count: Blob.ref_count + 1}, synchronize_session=False
    )


def decrement_blob_refcount(db: Session, sha256: str) -> None:
    """Decrement the ref_count for a blob. The actual storage delete is
    handled by a periodic sweeper; we never inline-delete here because
    a transaction may still roll back and we don't want to lose data."""
    db.query(Blob).filter(Blob.sha256 == sha256).update(
        {
            Blob.ref_count: func.greatest(Blob.ref_count - 1, 0),
        },
        synchronize_session=False,
    )


# ---------------------------------------------------------------------------
# Snapshot recording
# ---------------------------------------------------------------------------

def _next_version_for_node(
    db: Session,
    node_id: str | None,
    project_id: str,
    kind: SnapshotKind,
) -> int:
    """Pick the next monotonic version number.

    For node-scoped kinds, the counter is per ``(node_id, kind)``.
    For project-level kinds (Harris/Wheeler) where ``node_id`` is NULL,
    the counter is per ``(project_id, kind)``.
    """
    if node_id is not None:
        latest = db.execute(
            select(func.max(NodeSnapshot.version)).where(
                NodeSnapshot.node_id == node_id,
                NodeSnapshot.kind == kind.value,
            )
        ).scalar()
    else:
        latest = db.execute(
            select(func.max(NodeSnapshot.version)).where(
                NodeSnapshot.project_id == project_id,
                NodeSnapshot.node_id.is_(None),
                NodeSnapshot.kind == kind.value,
            )
        ).scalar()
    return (latest or 0) + 1


def record_snapshot(
    db: Session,
    *,
    project_id: str,
    node: FileNode | None,
    kind: SnapshotKind,
    reason: SnapshotReason,
    actor_id: str | None,
    blob_sha256: str | None = None,
    payload: Any | None = None,
    summary: str | None = None,
    acl_state: list[dict] | None = None,
    name_override: str | None = None,
    path_override: str | None = None,
    parent_id_override: str | None = None,
) -> NodeSnapshot:
    """Low-level snapshot recorder. Prefer the ``record_*`` helpers below."""
    node_id = node.id if node is not None else None
    version = _next_version_for_node(db, node_id, project_id, kind)
    snap = NodeSnapshot(
        project_id=project_id,
        node_id=node_id,
        kind=kind.value,
        version=version,
        blob_sha256=blob_sha256,
        payload=payload,
        path_at_snapshot=path_override
        if path_override is not None
        else (compute_path(db, node) if node is not None else None),
        name_at_snapshot=name_override
        if name_override is not None
        else (node.name if node is not None else None),
        parent_id_at_snapshot=parent_id_override
        if parent_id_override is not None
        else (node.parent_id if node is not None else None),
        acl_state_at_snapshot=acl_state,
        actor_id=actor_id,
        reason=reason.value,
        summary=summary,
    )
    db.add(snap)
    db.flush()
    return snap


# ---------------------------------------------------------------------------
# Concrete recorders
# ---------------------------------------------------------------------------

async def record_file_content(
    db: Session,
    *,
    node: FileNode,
    data: bytes,
    actor_id: str | None,
    reason: SnapshotReason,
    summary: str | None = None,
    mime_type: str | None = None,
) -> NodeSnapshot:
    """Record a binary content snapshot. Stores the bytes in the blob
    table (deduped) and writes a ``file_content`` snapshot referencing
    the blob.
    """
    blob = await ensure_blob(db, data, mime_type=mime_type or node.mime_type)
    increment_blob_refcount(db, blob.sha256)
    return record_snapshot(
        db,
        project_id=node.project_id,
        node=node,
        kind=SnapshotKind.FILE_CONTENT,
        reason=reason,
        actor_id=actor_id,
        blob_sha256=blob.sha256,
        summary=summary,
    )


def record_note_content(
    db: Session,
    *,
    node: FileNode,
    title: str,
    content: str,
    actor_id: str | None,
    reason: SnapshotReason,
    summary: str | None = None,
) -> NodeSnapshot:
    return record_snapshot(
        db,
        project_id=node.project_id,
        node=node,
        kind=SnapshotKind.NOTE_CONTENT,
        reason=reason,
        actor_id=actor_id,
        payload={"title": title, "content": content},
        summary=summary,
    )


def record_folder_metadata(
    db: Session,
    *,
    node: FileNode,
    actor_id: str | None,
    reason: SnapshotReason,
    summary: str | None = None,
    extra: dict | None = None,
) -> NodeSnapshot:
    payload = {"name": node.name, "parent_id": node.parent_id}
    if extra:
        payload.update(extra)
    return record_snapshot(
        db,
        project_id=node.project_id,
        node=node,
        kind=SnapshotKind.FOLDER_METADATA,
        reason=reason,
        actor_id=actor_id,
        payload=payload,
        summary=summary,
    )


def record_acl_change(
    db: Session,
    *,
    node: FileNode,
    actor_id: str | None,
    reason: SnapshotReason,
    summary: str | None = None,
) -> NodeSnapshot:
    """Capture the post-change ACL state of a node. Reading the chain
    of these rows lets the History UI ask "who has been added/removed
    over time" and supports per-change revert.
    """
    rows = db.query(FileNodeACL).filter(FileNodeACL.file_node_id == node.id).all()
    acl_state = [
        {
            "id": r.id,
            "user_id": r.user_id,
            "group_id": r.group_id,
            "can_read": r.can_read,
            "can_write": r.can_write,
        }
        for r in rows
    ]
    return record_snapshot(
        db,
        project_id=node.project_id,
        node=node,
        kind=SnapshotKind.ACL_CHANGE,
        reason=reason,
        actor_id=actor_id,
        acl_state=acl_state,
        summary=summary,
    )


def record_create(
    db: Session,
    *,
    node: FileNode,
    actor_id: str | None,
    summary: str | None = None,
) -> NodeSnapshot:
    return record_snapshot(
        db,
        project_id=node.project_id,
        node=node,
        kind=SnapshotKind.CREATE,
        reason=SnapshotReason.CREATE,
        actor_id=actor_id,
        payload={
            "name": node.name,
            "type": (node.type.value if hasattr(node.type, "value") else node.type),
            "parent_id": node.parent_id,
            "owner_id": node.owner_id,
            "is_acl_root": node.is_acl_root,
        },
        summary=summary,
    )


def record_delete(
    db: Session,
    *,
    node: FileNode,
    actor_id: str | None,
    summary: str | None = None,
) -> NodeSnapshot:
    """Record the *pre-delete* state of a node so it can be restored.

    Call this BEFORE ``db.delete(node)`` so the node still exists when
    the snapshot writes its name/path/parent.
    """
    payload = {
        "name": node.name,
        "type": (node.type.value if hasattr(node.type, "value") else node.type),
        "parent_id": node.parent_id,
        "owner_id": node.owner_id,
        "mime_type": node.mime_type,
        "size": node.size,
        "storage_path": node.storage_path,
        "is_acl_root": node.is_acl_root,
    }
    return record_snapshot(
        db,
        project_id=node.project_id,
        node=node,
        kind=SnapshotKind.DELETE,
        reason=SnapshotReason.DELETE,
        actor_id=actor_id,
        payload=payload,
        summary=summary,
    )


def record_project_data_snapshot(
    db: Session,
    *,
    project_id: str,
    kind: SnapshotKind,
    payload: Any,
    actor_id: str | None,
    reason: SnapshotReason = SnapshotReason.EDIT,
    summary: str | None = None,
) -> NodeSnapshot:
    """Used for Harris Matrix / Wheeler. ``node_id`` is NULL on the
    snapshot row because these payloads are project-scoped, not tied to
    a single FileNode."""
    if kind not in (SnapshotKind.HARRIS_MATRIX, SnapshotKind.WHEELER):
        raise ValueError(
            f"record_project_data_snapshot only supports Harris/Wheeler kinds, got {kind}"
        )
    return record_snapshot(
        db,
        project_id=project_id,
        node=None,
        kind=kind,
        reason=reason,
        actor_id=actor_id,
        payload=payload
        if isinstance(payload, (dict, list, str, int, float, bool))
        or payload is None
        else json.loads(json.dumps(payload, default=str)),
        summary=summary,
    )
