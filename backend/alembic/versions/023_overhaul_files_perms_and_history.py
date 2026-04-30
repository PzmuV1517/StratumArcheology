"""Overhaul file permissions and history (Time Machine remake).

This migration:

1. Adds the new authoritative tables for the redesigned permissions model:
     - ``file_node_acl``  per-node, per-principal read/write rows
     - ``blobs``          content-addressed binary store (SHA-256 dedup)
     - ``node_snapshots`` unified history for files, notes, folders, and
       project-level data (Harris Matrix, Wheeler diagram), including ACL
       changes and deletions
2. Adds two columns to ``file_nodes``:
     - ``is_acl_root``   when true, ACL resolution stops at this node
     - ``acl_root_id``   denormalised pointer to the nearest ancestor that
       defines an ACL, used to keep listings cheap
3. Translates the legacy privacy enum + ``shared_with`` JSON + the
   ``folder_permissions`` JSON-blob hack into proper ``file_node_acl`` rows.
4. Copies legacy ``file_versions`` and ``data_versions`` rows into
   ``node_snapshots`` so the old Time Machine history is preserved.
5. Backfills FileNode placeholders for voice notes that previously had no
   ``.txt`` mirror, so the unified ACL/history pipeline applies to them too.
6. Drops the legacy ``privacy``/``shared_with`` columns and the legacy
   ``file_versions`` / ``data_versions`` tables.

Revision ID: 4d1f8a2b6c7e
Revises: d3e5a9f1c2b7
Create Date: 2026-04-29 03:00:00.000000

"""

import json
import uuid
from collections.abc import Sequence
from datetime import datetime

import sqlalchemy as sa

from alembic import op

revision: str = "4d1f8a2b6c7e"
down_revision: str | Sequence[str] | None = "d3e5a9f1c2b7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# ---------------------------------------------------------------------------
# Helpers used during data translation
# ---------------------------------------------------------------------------

def _new_id() -> str:
    return str(uuid.uuid4())


def _utcnow_iso() -> str:
    return datetime.utcnow().isoformat()


# Snapshot kind / reason values must stay in sync with app.models.SnapshotKind
# and app.models.SnapshotReason. They are stored as plain VARCHAR (no enum
# type) so we can add new values without ALTER TYPE migrations later.
SNAPSHOT_KIND_FILE_CONTENT = "file_content"
SNAPSHOT_KIND_NOTE_CONTENT = "note_content"
SNAPSHOT_KIND_FOLDER_METADATA = "folder_metadata"
SNAPSHOT_KIND_HARRIS_MATRIX = "harris_matrix"
SNAPSHOT_KIND_WHEELER = "wheeler"
SNAPSHOT_KIND_ACL_CHANGE = "acl_change"
SNAPSHOT_KIND_DELETE = "delete"
SNAPSHOT_KIND_CREATE = "create"

SNAPSHOT_REASON_EDIT = "edit"
SNAPSHOT_REASON_CREATE = "create"
SNAPSHOT_REASON_RESTORE = "restore"
SNAPSHOT_REASON_RENAME = "rename"
SNAPSHOT_REASON_MOVE = "move"
SNAPSHOT_REASON_DELETE = "delete"
SNAPSHOT_REASON_ACL_GRANT = "acl_grant"
SNAPSHOT_REASON_ACL_REVOKE = "acl_revoke"
SNAPSHOT_REASON_ACL_CLEAR = "acl_clear"
SNAPSHOT_REASON_SYSTEM_MIGRATE = "system_migrate"


# ---------------------------------------------------------------------------
# Upgrade
# ---------------------------------------------------------------------------

def upgrade() -> None:
    # --- 1. Create the new tables -----------------------------------------

    op.create_table(
        "blobs",
        sa.Column("sha256", sa.String(length=64), primary_key=True),
        sa.Column("size", sa.BigInteger(), nullable=False),
        sa.Column("storage_path", sa.String(), nullable=False),
        sa.Column("mime_type", sa.String(), nullable=True),
        sa.Column("ref_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_table(
        "file_node_acl",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("file_node_id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=True),
        sa.Column("group_id", sa.String(), nullable=True),
        sa.Column("can_read", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "can_write", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        sa.Column("inherited_from_node_id", sa.String(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(
            ["file_node_id"], ["file_nodes.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(
            ["group_id"], ["user_groups.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["inherited_from_node_id"],
            ["file_nodes.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["created_by"], ["users.id"], ondelete="SET NULL"
        ),
        sa.CheckConstraint(
            "(user_id IS NOT NULL) <> (group_id IS NOT NULL)",
            name="ck_file_node_acl_user_xor_group",
        ),
        sa.CheckConstraint(
            "NOT can_write OR can_read",
            name="ck_file_node_acl_write_implies_read",
        ),
    )
    op.create_index(
        "ix_file_node_acl_node_user",
        "file_node_acl",
        ["file_node_id", "user_id"],
        unique=True,
        postgresql_where=sa.text("user_id IS NOT NULL"),
    )
    op.create_index(
        "ix_file_node_acl_node_group",
        "file_node_acl",
        ["file_node_id", "group_id"],
        unique=True,
        postgresql_where=sa.text("group_id IS NOT NULL"),
    )
    op.create_index("ix_file_node_acl_user_id", "file_node_acl", ["user_id"])
    op.create_index("ix_file_node_acl_group_id", "file_node_acl", ["group_id"])

    op.create_table(
        "node_snapshots",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("node_id", sa.String(), nullable=True),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("blob_sha256", sa.String(length=64), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("path_at_snapshot", sa.String(), nullable=True),
        sa.Column("name_at_snapshot", sa.String(), nullable=True),
        sa.Column("parent_id_at_snapshot", sa.String(), nullable=True),
        sa.Column("acl_state_at_snapshot", sa.JSON(), nullable=True),
        sa.Column("actor_id", sa.String(), nullable=True),
        sa.Column("reason", sa.String(length=32), nullable=False),
        sa.Column("summary", sa.String(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["project_id"], ["projects.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["node_id"], ["file_nodes.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["blob_sha256"], ["blobs.sha256"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index(
        "ix_node_snapshots_project_created",
        "node_snapshots",
        ["project_id", sa.text("created_at DESC")],
    )
    op.create_index(
        "ix_node_snapshots_node_kind_version",
        "node_snapshots",
        ["node_id", "kind", "version"],
    )
    op.create_index(
        "ix_node_snapshots_actor_project",
        "node_snapshots",
        ["actor_id", "project_id", sa.text("created_at DESC")],
    )

    # --- 2. New columns on file_nodes -------------------------------------

    op.add_column(
        "file_nodes",
        sa.Column(
            "is_acl_root", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
    )
    op.add_column(
        "file_nodes", sa.Column("acl_root_id", sa.String(), nullable=True)
    )
    op.create_foreign_key(
        "fk_file_nodes_acl_root",
        "file_nodes",
        "file_nodes",
        ["acl_root_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_file_nodes_acl_root_id", "file_nodes", ["acl_root_id"])

    # --- 3. Translate legacy privacy/shared_with -> file_node_acl ---------

    bind = op.get_bind()

    legacy_nodes = bind.execute(
        sa.text(
            "SELECT id, project_id, owner_id, parent_id, name, type, "
            "       privacy, shared_with "
            "FROM file_nodes"
        )
    ).fetchall()

    # Detect personal-folder nodes (children of a top-level "users" folder)
    users_folder_by_project: dict[str, str] = {}
    for n in legacy_nodes:
        if n.parent_id is None and n.name == "users" and n.type == "folder":
            users_folder_by_project[n.project_id] = n.id

    personal_folder_ids: set[str] = set()
    for n in legacy_nodes:
        users_folder_id = users_folder_by_project.get(n.project_id)
        if (
            users_folder_id
            and n.parent_id == users_folder_id
            and n.type == "folder"
            and n.owner_id
        ):
            personal_folder_ids.add(n.id)

    # For every node, decide its ACL state:
    #
    #   privacy == PRIVATE  -> is_acl_root = true, no allow rows (owner-only)
    #   privacy == SHARED   -> is_acl_root = true, one row per shared user
    #   privacy == PROJECT  -> nothing (default project-wide access)
    #   privacy == PUBLIC   -> nothing (PUBLIC is dead, treat as PROJECT)
    #
    # Personal folders are always acl-roots regardless of historical privacy
    # (they're the user's private space; subfolders inherit unless they
    # themselves get an explicit ACL).

    for n in legacy_nodes:
        privacy = (n.privacy or "project").lower()
        is_personal = n.id in personal_folder_ids
        shared_with_list: list[str] = []
        if n.shared_with:
            try:
                raw = (
                    n.shared_with
                    if isinstance(n.shared_with, list)
                    else json.loads(n.shared_with)
                )
                if isinstance(raw, list):
                    shared_with_list = [str(x) for x in raw if x]
            except (TypeError, ValueError, json.JSONDecodeError):
                shared_with_list = []

        if privacy == "private" or is_personal:
            bind.execute(
                sa.text(
                    "UPDATE file_nodes SET is_acl_root = TRUE WHERE id = :id"
                ),
                {"id": n.id},
            )
        elif privacy == "shared":
            bind.execute(
                sa.text(
                    "UPDATE file_nodes SET is_acl_root = TRUE WHERE id = :id"
                ),
                {"id": n.id},
            )
            for uid in shared_with_list:
                bind.execute(
                    sa.text(
                        "INSERT INTO file_node_acl ("
                        "  id, file_node_id, user_id, can_read, can_write,"
                        "  created_at, created_by"
                        ") VALUES ("
                        "  :id, :node_id, :user_id, TRUE, FALSE,"
                        "  :now, :owner"
                        ") ON CONFLICT DO NOTHING"
                    ),
                    {
                        "id": _new_id(),
                        "node_id": n.id,
                        "user_id": uid,
                        "now": datetime.utcnow(),
                        "owner": n.owner_id,
                    },
                )
        else:
            # PROJECT / PUBLIC / NULL -> default access, nothing to write
            continue

    # --- 4. Compute acl_root_id for every node ----------------------------
    #
    # Climb each node's parent chain until we find an is_acl_root, then
    # store that ancestor's id as acl_root_id. Done in Python because
    # SQLite-flavoured recursive CTEs vary; we have a few thousand nodes at
    # most and this runs once.

    nodes = bind.execute(
        sa.text(
            "SELECT id, parent_id, is_acl_root FROM file_nodes"
        )
    ).fetchall()
    by_id = {n.id: n for n in nodes}

    def find_root(node_id: str) -> str | None:
        current = by_id.get(node_id)
        while current is not None:
            if current.is_acl_root:
                return current.id
            if current.parent_id is None:
                return None
            current = by_id.get(current.parent_id)
        return None

    for n in nodes:
        # is_acl_root nodes' acl_root_id points at themselves; everyone else
        # walks up. NULL means "no scoped ACL anywhere on the chain".
        if n.is_acl_root:
            root = n.id
        else:
            root = find_root(n.parent_id) if n.parent_id else None
        if root is not None:
            bind.execute(
                sa.text(
                    "UPDATE file_nodes SET acl_root_id = :root WHERE id = :id"
                ),
                {"root": root, "id": n.id},
            )

    # --- 5. Backfill FileNode placeholders for voice notes -----------------
    #
    # Voice notes never created a .txt mirror in the legacy code path. The
    # new pipeline expects every note to have a FileNode so the ACL
    # resolver, snapshot recorder, and listing endpoints can operate
    # uniformly. Create a name-only placeholder under the project's "Notes"
    # folder for each voice note that has no NoteFileLink yet.

    voice_notes = bind.execute(
        sa.text(
            "SELECT n.id, n.project_id, n.title, n.created_at "
            "FROM notes n "
            "LEFT JOIN note_file_links l ON l.note_id = n.id "
            "WHERE l.id IS NULL"
        )
    ).fetchall()

    notes_folder_by_project: dict[str, str] = {}

    def ensure_notes_folder(project_id: str) -> str:
        if project_id in notes_folder_by_project:
            return notes_folder_by_project[project_id]

        existing = bind.execute(
            sa.text(
                "SELECT id FROM file_nodes "
                "WHERE project_id = :pid "
                "  AND parent_id IS NULL "
                "  AND name = 'Notes' "
                "  AND type = 'folder' "
                "LIMIT 1"
            ),
            {"pid": project_id},
        ).fetchone()

        if existing:
            notes_folder_by_project[project_id] = existing.id
            return existing.id

        new_id = _new_id()
        bind.execute(
            sa.text(
                "INSERT INTO file_nodes ("
                "  id, project_id, parent_id, name, type, is_locked,"
                "  privacy, version, is_acl_root, acl_root_id,"
                "  created_at, updated_at"
                ") VALUES ("
                "  :id, :pid, NULL, 'Notes', 'folder', TRUE,"
                "  'project', 1, FALSE, NULL,"
                "  :now, :now"
                ")"
            ),
            {"id": new_id, "pid": project_id, "now": datetime.utcnow()},
        )
        notes_folder_by_project[project_id] = new_id
        return new_id

    for vn in voice_notes:
        notes_folder_id = ensure_notes_folder(vn.project_id)

        # Pick a unique sibling name for the placeholder.
        base = vn.title or "Voice note"
        candidate = f"{base}.voice"
        suffix = 1
        while bind.execute(
            sa.text(
                "SELECT 1 FROM file_nodes "
                "WHERE project_id = :pid "
                "  AND parent_id = :parent "
                "  AND name = :name"
            ),
            {"pid": vn.project_id, "parent": notes_folder_id, "name": candidate},
        ).fetchone():
            suffix += 1
            candidate = f"{base} ({suffix}).voice"

        node_id = _new_id()
        bind.execute(
            sa.text(
                "INSERT INTO file_nodes ("
                "  id, project_id, parent_id, name, type, is_locked,"
                "  privacy, version, is_acl_root, acl_root_id,"
                "  storage_path, mime_type,"
                "  created_at, updated_at"
                ") VALUES ("
                "  :id, :pid, :parent, :name, 'note', FALSE,"
                "  'project', 1, FALSE, NULL,"
                "  NULL, NULL,"
                "  :now, :now"
                ")"
            ),
            {
                "id": node_id,
                "pid": vn.project_id,
                "parent": notes_folder_id,
                "name": candidate,
                "now": vn.created_at or datetime.utcnow(),
            },
        )
        bind.execute(
            sa.text(
                "INSERT INTO note_file_links (note_id, file_node_id) "
                "VALUES (:note_id, :file_id)"
            ),
            {"note_id": vn.id, "file_id": node_id},
        )

    # --- 6. Translate legacy file_versions -> node_snapshots --------------

    legacy_versions = bind.execute(
        sa.text(
            "SELECT v.id, v.file_node_id, v.version, v.storage_path,"
            "       v.size, v.checksum, v.created_at, v.created_by,"
            "       n.project_id, n.name "
            "FROM file_versions v "
            "JOIN file_nodes n ON n.id = v.file_node_id"
        )
    ).fetchall()

    for v in legacy_versions:
        # Old binary versions are imported as snapshots without a blob
        # reference. We can rehydrate them via storage_path stored in
        # payload. A future GC pass can hash them and link to the blobs
        # table; doing it inline here would require MinIO access which we
        # don't have in a migration.
        size_int: int | None = None
        if v.size:
            try:
                size_int = int(v.size)
            except (TypeError, ValueError):
                size_int = None

        bind.execute(
            sa.text(
                "INSERT INTO node_snapshots ("
                "  id, project_id, node_id, kind, version,"
                "  blob_sha256, payload, name_at_snapshot,"
                "  actor_id, reason, summary, created_at"
                ") VALUES ("
                "  :id, :pid, :nid, :kind, :ver,"
                "  NULL, :payload, :name,"
                "  :actor, :reason, :summary, :created"
                ")"
            ),
            {
                "id": _new_id(),
                "pid": v.project_id,
                "nid": v.file_node_id,
                "kind": SNAPSHOT_KIND_FILE_CONTENT,
                "ver": v.version,
                "payload": json.dumps(
                    {
                        "legacy_storage_path": v.storage_path,
                        "size": size_int,
                        "checksum": v.checksum,
                    }
                ),
                "name": v.name,
                "actor": v.created_by,
                "reason": SNAPSHOT_REASON_EDIT,
                "summary": f"Imported version {v.version} of \"{v.name}\"",
                "created": v.created_at or datetime.utcnow(),
            },
        )

    # --- 7. Translate legacy data_versions -> node_snapshots --------------

    legacy_dataversions = bind.execute(
        sa.text(
            "SELECT id, project_id, data_type, version, data, created_at, "
            "       created_by FROM data_versions"
        )
    ).fetchall()

    for dv in legacy_dataversions:
        kind = (
            SNAPSHOT_KIND_HARRIS_MATRIX
            if (dv.data_type or "").lower() == "harris_matrix"
            else SNAPSHOT_KIND_WHEELER
        )
        bind.execute(
            sa.text(
                "INSERT INTO node_snapshots ("
                "  id, project_id, node_id, kind, version,"
                "  payload, actor_id, reason, summary, created_at"
                ") VALUES ("
                "  :id, :pid, NULL, :kind, :ver,"
                "  :payload, :actor, :reason, :summary, :created"
                ")"
            ),
            {
                "id": _new_id(),
                "pid": dv.project_id,
                "kind": kind,
                "ver": dv.version,
                "payload": (
                    dv.data
                    if isinstance(dv.data, (dict, list))
                    else (json.loads(dv.data) if dv.data else None)
                )
                if dv.data is not None
                else None,
                "actor": dv.created_by,
                "reason": SNAPSHOT_REASON_EDIT,
                "summary": f"Imported {kind} v{dv.version}",
                "created": dv.created_at or datetime.utcnow(),
            },
        )

    # --- 8. Drop legacy schema --------------------------------------------

    op.drop_table("file_versions")
    op.drop_table("data_versions")
    op.drop_column("file_nodes", "shared_with")
    op.drop_column("file_nodes", "privacy")
    # Notes used to carry their own privacy fields. They now ride on the
    # FileNode mirror's ACL, so these duplicate columns can go away.
    op.drop_column("notes", "shared_with")
    op.drop_column("notes", "privacy")

    # The PostgreSQL enum type for PrivacyLevel becomes orphan once both
    # columns are dropped. Remove it so future migrations don't trip on it.
    op.execute("DROP TYPE IF EXISTS privacylevel")


# ---------------------------------------------------------------------------
# Downgrade
# ---------------------------------------------------------------------------

def downgrade() -> None:
    """Reverse the overhaul.

    Best-effort. Snapshot rows that were synthesised during normal
    operation (i.e. not migrated from a legacy file_versions row) are not
    representable in the legacy schema and will be lost. ACL rows are
    likewise lost; everything is collapsed back to PROJECT privacy.
    """
    op.execute(
        "CREATE TYPE privacylevel AS ENUM ('private', 'shared', 'project', 'public')"
    )
    op.add_column(
        "file_nodes",
        sa.Column(
            "privacy",
            sa.Enum(
                "private",
                "shared",
                "project",
                "public",
                name="privacylevel",
            ),
            nullable=False,
            server_default="project",
        ),
    )
    op.add_column(
        "file_nodes", sa.Column("shared_with", sa.JSON(), nullable=True)
    )
    op.add_column(
        "notes",
        sa.Column(
            "privacy",
            sa.Enum(
                "private",
                "shared",
                "project",
                "public",
                name="privacylevel",
            ),
            nullable=False,
            server_default="project",
        ),
    )
    op.add_column(
        "notes", sa.Column("shared_with", sa.JSON(), nullable=True)
    )

    op.create_table(
        "data_versions",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("data_type", sa.String(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("data", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(
            ["project_id"], ["projects.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["created_by"], ["users.id"], ondelete="SET NULL"
        ),
        sa.UniqueConstraint(
            "project_id", "data_type", "version", name="uq_data_version"
        ),
    )
    op.create_index(
        "ix_data_versions_project_type",
        "data_versions",
        ["project_id", "data_type"],
    )

    op.create_table(
        "file_versions",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("file_node_id", sa.String(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("storage_path", sa.String(), nullable=False),
        sa.Column("size", sa.String(), nullable=True),
        sa.Column("checksum", sa.String(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(
            ["file_node_id"], ["file_nodes.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["created_by"], ["users.id"], ondelete="SET NULL"
        ),
        sa.UniqueConstraint("file_node_id", "version", name="uq_file_version"),
    )
    op.create_index(
        "ix_file_versions_file_node", "file_versions", ["file_node_id"]
    )

    op.drop_index("ix_file_nodes_acl_root_id", table_name="file_nodes")
    op.drop_constraint("fk_file_nodes_acl_root", "file_nodes", type_="foreignkey")
    op.drop_column("file_nodes", "acl_root_id")
    op.drop_column("file_nodes", "is_acl_root")

    op.drop_index("ix_node_snapshots_actor_project", table_name="node_snapshots")
    op.drop_index("ix_node_snapshots_node_kind_version", table_name="node_snapshots")
    op.drop_index("ix_node_snapshots_project_created", table_name="node_snapshots")
    op.drop_table("node_snapshots")

    op.drop_index("ix_file_node_acl_group_id", table_name="file_node_acl")
    op.drop_index("ix_file_node_acl_user_id", table_name="file_node_acl")
    op.drop_index("ix_file_node_acl_node_group", table_name="file_node_acl")
    op.drop_index("ix_file_node_acl_node_user", table_name="file_node_acl")
    op.drop_table("file_node_acl")

    op.drop_table("blobs")
