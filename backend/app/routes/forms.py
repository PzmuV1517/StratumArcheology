"""
Archaeological form management API routes.

Handles appending structured records (context features, stratigraphic units,
artefacts) to locked CSV files within project Forms folders.

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

import csv
import io
from datetime import datetime

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import check_project_permission, get_current_user
from app.minio_client import minio_client
from app.models import FileNode, FileNodeType, User
from app.websocket import emit_content_update, log_activity

router = APIRouter(prefix="/forms", tags=["forms"])


def _find_child_by_name(
    db: Session, project_id: str, parent_id: str | None, name: str
) -> FileNode | None:
    """Find a FileNode by name under a given parent folder.

    Args:
        db: Database session.
        project_id: The project UUID to search within.
        parent_id: Parent folder UUID, or None for root-level nodes.
        name: Exact filename or folder name to match.

    Returns:
        The matching FileNode, or None if not found.
    """
    q = db.query(FileNode).filter(
        FileNode.project_id == project_id, FileNode.name == name
    )
    if parent_id:
        q = q.filter(FileNode.parent_id == parent_id)
    else:
        q = q.filter(FileNode.parent_id == None)  # noqa: E711
    return q.first()


def _ensure_locked_folder(
    db: Session, project_id: str, name: str, parent_id: str | None = None
) -> FileNode:
    """Ensure a locked folder exists, creating it if necessary.

    If the folder already exists but is not locked, it will be locked.

    Args:
        db: Database session.
        project_id: The project UUID.
        name: Folder name.
        parent_id: Optional parent folder UUID (None for root level).

    Returns:
        The existing or newly created locked FileNode folder.
    """
    node = _find_child_by_name(db, project_id, parent_id, name)
    if node is None:
        node = FileNode(
            project_id=project_id,
            parent_id=parent_id,
            name=name,
            type=FileNodeType.FOLDER,
            is_locked=True,
        )
        db.add(node)
        db.commit()
        db.refresh(node)
    else:
        # Ensure locked
        if not node.is_locked:
            node.is_locked = True
            node.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(node)
    return node


def _ensure_locked_csv_file(
    db: Session, project_id: str, parent_id: str, filename: str, header: list[str]
) -> tuple[FileNode, list[list[str]]]:
    """
    Ensure a locked CSV file exists under parent_id and return (node, existing_rows).
    existing_rows excludes the header row.
    """
    node = _find_child_by_name(db, project_id, parent_id, filename)
    object_path = f"forms/{project_id}/{filename}"
    if node is None:
        # Create new node and upload header-only CSV
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(header)
        data_bytes = output.getvalue().encode("utf-8")
        # Upload and create node
        awaitable = minio_client.upload_file(
            data_bytes, object_path, content_type="text/csv"
        )
        # minio_client methods are async; but FastAPI handlers will call this inside async context
        # We'll execute upload in the handler; here we just prepare
        node = FileNode(
            project_id=project_id,
            parent_id=parent_id,
            name=filename,
            type=FileNodeType.FILE,
            mime_type="text/csv",
            size=str(len(data_bytes)),
            storage_path=object_path,
            is_locked=True,
        )
        db.add(node)
        db.commit()
        db.refresh(node)
        return node, []
    else:
        # Ensure locked/mime
        updated = False
        if not node.is_locked:
            node.is_locked = True
            updated = True
        if node.mime_type != "text/csv":
            node.mime_type = "text/csv"
            updated = True
        if node.storage_path is None:
            node.storage_path = object_path
            updated = True
        if updated:
            node.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(node)
        # Load existing content (if any) and parse rows excluding header
        rows: list[list[str]] = []
        try:
            data = None
            # minio get_file returns None if missing
            data = minio_client.client.get_object(
                minio_client.bucket_name, node.storage_path
            )
            # Stream read
            buf = data.read()
            data.close()
            data.release_conn()
            if buf:
                s = buf.decode("utf-8", errors="ignore")
                r = csv.reader(io.StringIO(s))
                for i, row in enumerate(r):
                    if i == 0:
                        continue  # skip header
                    rows.append([str(x) for x in row])
        except Exception:
            # Treat as empty
            rows = []
        return node, rows


def _serialize_bool(v: bool | None) -> str:
    """Serialize a boolean value to '1' or '0' for CSV output.

    Args:
        v: Boolean value, or None (treated as False).

    Returns:
        '1' if truthy, '0' otherwise.
    """
    return "1" if v else "0"


@router.post(
    "/project/{project_id}/context-feature", status_code=status.HTTP_201_CREATED
)
async def append_context_feature(
    project_id: str,
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Append a Context Feature record to CSV in a locked Forms folder."""
    check_project_permission(project_id, current_user, db)

    # Ensure Forms folder
    forms_folder = _ensure_locked_folder(db, project_id, "Forms")

    # Prepare header and row (flatten payload)
    header = [
        "id",
        "featureNumber",
        "sector",
        "earlierThan",
        "laterThan",
        "featureType",
        "location",
        "length",
        "width",
        "depth",
        "x",
        "y",
        "zMasl",
        "shape",
        "orientation",
        "finds_pottery",
        "finds_metal",
        "finds_flint",
        "finds_stone",
        "finds_wood",
        "finds_charcoal",
        "finds_shell",
        "finds_snail",
        "finds_ash",
        "finds_adobe",
        "finds_beads",
        "finds_pendant",
        "finds_ring",
        "finds_seed",
        "finds_animalBones",
        "finds_humanBones",
        "finds_other",
        "description",
        "doc_drawing",
        "doc_plan",
        "doc_photogrammetry",
        "doc_photos",
        "doc_video",
        "planNumber",
        "samp_environmental",
        "samp_aDNA",
        "samp_c14",
        "samp_isotopic",
        "samp_other",
        "sampleOtherType",
        "sampleBagNo",
        "sampleQty",
        "author",
        "dateCreated",
        "checkedBy",
        "dateChecked",
    ]

    def val(k, default=None):
        return payload.get(k, default)

    dims = payload.get("dimensions") or {}
    coords = payload.get("coordinates") or {}
    finds = payload.get("findsPresent") or {}
    docs = payload.get("documentation") or {}
    samp = payload.get("samples") or {}

    row = [
        val("id", ""),
        payload.get("featureNumber", ""),
        payload.get("sector", ""),
        ";".join(payload.get("earlierThan") or []),
        ";".join(payload.get("laterThan") or []),
        payload.get("featureType", ""),
        payload.get("location", ""),
        str(dims.get("length") or ""),
        str(dims.get("width") or ""),
        str(dims.get("depth") or ""),
        str(coords.get("x") or ""),
        str(coords.get("y") or ""),
        str(coords.get("zMasl") or ""),
        payload.get("shape", ""),
        payload.get("orientation", ""),
        _serialize_bool(finds.get("pottery")),
        _serialize_bool(finds.get("metal")),
        _serialize_bool(finds.get("flint")),
        _serialize_bool(finds.get("stone")),
        _serialize_bool(finds.get("wood")),
        _serialize_bool(finds.get("charcoal")),
        _serialize_bool(finds.get("shell")),
        _serialize_bool(finds.get("snail")),
        _serialize_bool(finds.get("ash")),
        _serialize_bool(finds.get("adobe")),
        _serialize_bool(finds.get("beads")),
        _serialize_bool(finds.get("pendant")),
        _serialize_bool(finds.get("ring")),
        _serialize_bool(finds.get("seed")),
        _serialize_bool(finds.get("animalBones")),
        _serialize_bool(finds.get("humanBones")),
        _serialize_bool(finds.get("other")),
        payload.get("description", ""),
        _serialize_bool(docs.get("drawing")),
        _serialize_bool(docs.get("plan")),
        _serialize_bool(docs.get("photogrammetry")),
        _serialize_bool(docs.get("photos")),
        _serialize_bool(docs.get("video")),
        docs.get("planNumber", ""),
        _serialize_bool(samp.get("environmental")),
        _serialize_bool(samp.get("aDNA")),
        _serialize_bool(samp.get("c14")),
        _serialize_bool(samp.get("isotopic")),
        _serialize_bool(samp.get("other")),
        samp.get("otherType", ""),
        samp.get("bagNo", ""),
        str(samp.get("quantity") or ""),
        payload.get("author", ""),
        payload.get("dateCreated", ""),
        payload.get("checkedBy", ""),
        payload.get("dateChecked", ""),
    ]

    # Ensure file and existing rows
    node, existing = _ensure_locked_csv_file(
        db, project_id, forms_folder.id, "context_features.csv", header
    )

    # Append new row and upload entire content
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(header)
    for r in existing:
        writer.writerow(r)
    writer.writerow(row)
    data_bytes = output.getvalue().encode("utf-8")
    await minio_client.upload_file(
        data_bytes,
        node.storage_path or f"forms/{project_id}/context_features.csv",
        content_type="text/csv",
    )

    # Update size/mtime
    node.size = str(len(data_bytes))
    node.updated_at = datetime.utcnow()
    db.commit()

    # Notify all users in project that forms have been updated (context feature added)
    await emit_content_update(project_id, "forms")

    # Log activity for timeline
    await log_activity(
        db=db,
        project_id=project_id,
        activity_type="context_feature_added",
        description=f"Added context feature: {payload.get('feature_type', payload.get('name', 'unknown'))}",
        user_id=current_user.id,
        metadata={"form_data": payload},
    )

    return {"status": "ok"}


@router.post(
    "/project/{project_id}/stratigraphic-unit", status_code=status.HTTP_201_CREATED
)
async def append_stratigraphic_unit(
    project_id: str,
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Append a Stratigraphic Unit record to CSV in a locked Forms folder."""
    check_project_permission(project_id, current_user, db)

    forms_folder = _ensure_locked_folder(db, project_id, "Forms")

    header = [
        "id",
        "sector",
        "complexFeatureNo",
        "earlierThan",
        "laterThan",
        "unitType",
        "location",
        "length",
        "thickness",
        "depth",
        "areaSurface",
        "orientation",
        "structure_compaction",
        "structure_colour",
        "structure_munsell",
        "structure_homogeneous",
        "structure_heterogeneous",
        "comp_pottery",
        "comp_flint",
        "comp_stone",
        "comp_wood",
        "comp_charcoal",
        "comp_shell",
        "comp_snail",
        "comp_ash",
        "comp_adobe",
        "comp_metal",
        "comp_organic",
        "comp_mineral",
        "comp_gravels",
        "comp_silt",
        "comp_sand",
        "comp_argil",
        "comp_loess",
        "comp_mud",
        "comp_other",
        "granulation",
        "contaminationRisk",
        "bones",
        "seed",
        "pert_natural",
        "pert_anthropic",
        "pert_burrow",
        "pert_roots",
        "pert_other",
        "pert_otherType",
        "description",
        "doc_drawing",
        "doc_plan",
        "doc_photogrammetry",
        "doc_samples",
        "doc_photos",
        "doc_video",
        "planNumber",
        "author",
        "dateCreated",
        "checkedBy",
        "dateChecked",
    ]

    def val(k, default=None):
        return payload.get(k, default)

    dims = payload.get("dimensions") or {}
    structure = payload.get("structure") or {}
    comp = payload.get("composition") or {}
    pert = payload.get("perturbation") or {}
    docs = payload.get("documentation") or {}

    row = [
        val("id", ""),
        payload.get("sector", ""),
        payload.get("complexFeatureNo", ""),
        ";".join(payload.get("earlierThan") or []),
        ";".join(payload.get("laterThan") or []),
        payload.get("unitType", ""),
        payload.get("location", ""),
        str(dims.get("length") or ""),
        str(dims.get("thickness") or ""),
        str(dims.get("depth") or ""),
        str(dims.get("areaSurface") or ""),
        payload.get("orientation", ""),
        structure.get("compaction", ""),
        structure.get("colour", ""),
        structure.get("munsellCode", ""),
        _serialize_bool(structure.get("homogeneous")),
        _serialize_bool(structure.get("heterogeneous")),
        _serialize_bool(comp.get("pottery")),
        _serialize_bool(comp.get("flint")),
        _serialize_bool(comp.get("stone")),
        _serialize_bool(comp.get("wood")),
        _serialize_bool(comp.get("charcoal")),
        _serialize_bool(comp.get("shell")),
        _serialize_bool(comp.get("snail")),
        _serialize_bool(comp.get("ash")),
        _serialize_bool(comp.get("adobe")),
        _serialize_bool(comp.get("metal")),
        _serialize_bool(comp.get("organic")),
        _serialize_bool(comp.get("mineral")),
        _serialize_bool(comp.get("gravels")),
        _serialize_bool(comp.get("silt")),
        _serialize_bool(comp.get("sand")),
        _serialize_bool(comp.get("argil")),
        _serialize_bool(comp.get("loess")),
        _serialize_bool(comp.get("mud")),
        _serialize_bool(comp.get("other")),
        payload.get("granulation", ""),
        payload.get("contaminationRisk", ""),
        _serialize_bool(payload.get("bones")),
        _serialize_bool(payload.get("seed")),
        _serialize_bool(pert.get("natural")),
        _serialize_bool(pert.get("anthropic")),
        _serialize_bool(pert.get("burrow")),
        _serialize_bool(pert.get("roots")),
        _serialize_bool(pert.get("other")),
        pert.get("otherType", ""),
        payload.get("description", ""),
        _serialize_bool(docs.get("drawing")),
        _serialize_bool(docs.get("plan")),
        _serialize_bool(docs.get("photogrammetry")),
        _serialize_bool(docs.get("samples")),
        _serialize_bool(docs.get("photos")),
        _serialize_bool(docs.get("video")),
        docs.get("planNumber", ""),
        payload.get("author", ""),
        payload.get("dateCreated", ""),
        payload.get("checkedBy", ""),
        payload.get("dateChecked", ""),
    ]

    node, existing = _ensure_locked_csv_file(
        db, project_id, forms_folder.id, "stratigraphic_units.csv", header
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(header)
    for r in existing:
        writer.writerow(r)
    writer.writerow(row)
    data_bytes = output.getvalue().encode("utf-8")
    await minio_client.upload_file(
        data_bytes,
        node.storage_path or f"forms/{project_id}/stratigraphic_units.csv",
        content_type="text/csv",
    )

    node.size = str(len(data_bytes))
    node.updated_at = datetime.utcnow()
    db.commit()

    # Notify all users in project that forms have been updated (stratigraphic unit added)
    await emit_content_update(project_id, "forms")

    # Log activity for timeline
    await log_activity(
        db=db,
        project_id=project_id,
        activity_type="stratigraphic_unit_added",
        description=f"Added stratigraphic unit: {payload.get('id', payload.get('sector', 'unknown'))}",
        user_id=current_user.id,
        metadata={"form_data": payload},
    )

    return {"status": "ok"}


@router.get("/project/{project_id}/artefacts")
async def get_artefacts(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all artefacts for a project from the CSV file."""
    check_project_permission(project_id, current_user, db)

    # Find the artefacts.csv file
    forms_folder = _find_child_by_name(db, project_id, None, "Forms")
    if not forms_folder:
        return []

    artefacts_file = _find_child_by_name(
        db, project_id, forms_folder.id, "artefacts.csv"
    )
    if not artefacts_file or not artefacts_file.storage_path:
        return []

    # Read and parse CSV
    try:
        data = minio_client.client.get_object(
            minio_client.bucket_name, artefacts_file.storage_path
        )
        buf = data.read()
        data.close()
        data.release_conn()

        if not buf:
            return []

        s = buf.decode("utf-8", errors="ignore")
        reader = csv.DictReader(io.StringIO(s))
        artefacts = []
        for row in reader:
            artefacts.append(dict(row))
        return artefacts
    except Exception as e:
        # File doesn't exist or can't be read
        print(f"Error reading artefacts: {e}")
        return []


@router.post("/project/{project_id}/artefact", status_code=status.HTTP_201_CREATED)
async def append_artefact(
    project_id: str,
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Append an Artefact registry entry to CSV in a locked Forms folder."""
    check_project_permission(project_id, current_user, db)

    forms_folder = _ensure_locked_folder(db, project_id, "Forms")

    header = [
        "category",
        "number",
        "type",
        "complexFeature",
        "areaSurface",
        "gridSquare",
        "depth",
        "stratigraphicUnit",
        "quantity",
        "otherObservations",
    ]

    row = [
        payload.get("category", ""),
        payload.get("number", ""),
        payload.get("type", ""),
        payload.get("complexFeature", ""),
        payload.get("areaSurface", ""),
        payload.get("gridSquare", ""),
        payload.get("depth", ""),
        payload.get("stratigraphicUnit", ""),
        str(payload.get("quantity") or ""),
        payload.get("otherObservations", ""),
    ]

    node, existing = _ensure_locked_csv_file(
        db, project_id, forms_folder.id, "artefacts.csv", header
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(header)
    for r in existing:
        writer.writerow(r)
    writer.writerow(row)
    data_bytes = output.getvalue().encode("utf-8")
    await minio_client.upload_file(
        data_bytes,
        node.storage_path or f"forms/{project_id}/artefacts.csv",
        content_type="text/csv",
    )

    node.size = str(len(data_bytes))
    node.updated_at = datetime.utcnow()
    db.commit()

    # Notify all users in project that forms have been updated (artefact added)
    await emit_content_update(project_id, "forms")

    # Log activity for timeline
    await log_activity(
        db=db,
        project_id=project_id,
        activity_type="artefact_added",
        description=f"Added artefact: {payload.get('artefact_id', payload.get('name', payload.get('type', 'unknown')))}",
        user_id=current_user.id,
        metadata={"form_data": payload},
    )

    return {"status": "ok"}
