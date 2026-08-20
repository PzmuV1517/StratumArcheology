"""
GPS coordinate management API routes.

Handles reading and updating GPS coordinates (work areas and excavation
site polygons) for archaeological projects.

STRATUM - Proprietary and Confidential
Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
All rights reserved.
No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
"""

import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import check_project_permission, get_current_user
from app.models import Project, ProjectGPS, User
from app.websocket import log_activity

router = APIRouter()


class LatLng(BaseModel):
    """A geographic coordinate pair.

    Attributes:
        lat: Latitude in decimal degrees.
        lng: Longitude in decimal degrees.
    """

    lat: float
    lng: float


class PolyShape(BaseModel):
    """A polyline or polygon defined by ordered GPS coordinates.

    Attributes:
        points: Ordered list of coordinate vertices.
        closed: If True the shape forms a closed polygon; otherwise an open polyline.
    """

    points: list[LatLng]
    closed: bool = False


class GPSState(BaseModel):
    """Complete GPS state for a project.

    Attributes:
        work: Optional work area polygon bounding the excavation site.
        sites: List of individual excavation site polygons.
    """

    work: PolyShape | None = None
    sites: list[PolyShape] = []


@router.get("/projects/{project_id}/gps", response_model=GPSState)
def get_project_gps(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve the GPS coordinate state for a project.

    Restricted to project members: site coordinates identify unexcavated
    ground and are a looting risk if published. Public projects expose
    their GPS through /projects/public/{id} instead.

    Args:
        project_id: The project UUID.
        db: Database session.
        current_user: The authenticated user making the request.

    Returns:
        GPSState with the current work area and site polygons.

    Raises:
        HTTPException: 404 if the project does not exist, 403 if the user
            is not a member.
    """
    # Validate project exists
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    check_project_permission(project_id, current_user, db)

    row = db.query(ProjectGPS).filter(ProjectGPS.project_id == project_id).first()
    if not row or not row.data:
        return GPSState(work=None, sites=[])
    try:
        payload = json.loads(row.data)
        return GPSState(**payload)
    except Exception:
        # Corrupt data fallback
        return GPSState(work=None, sites=[])


@router.put("/projects/{project_id}/gps", response_model=GPSState)
async def put_project_gps(
    project_id: str,
    state: GPSState,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create or update the GPS coordinate state for a project.

    Args:
        project_id: The project UUID.
        state: The new GPS state to persist.
        db: Database session.
        current_user: The authenticated user performing the update.

    Returns:
        The saved GPSState.

    Raises:
        HTTPException: 404 if the project does not exist.
    """
    # Validate project exists
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    check_project_permission(
        project_id, current_user, db, required_role="researcher"
    )

    row = db.query(ProjectGPS).filter(ProjectGPS.project_id == project_id).first()
    payload = state.model_dump()
    data_str = json.dumps(payload)
    if row:
        row.data = data_str
    else:
        row = ProjectGPS(project_id=project_id, data=data_str)
        db.add(row)
    db.commit()

    await log_activity(
        db=db,
        project_id=project_id,
        activity_type="gps_updated",
        description="Updated GPS coordinates",
        user_id=current_user.id,
        metadata={
            "has_work_area": state.work is not None,
            "sites_count": len(state.sites),
        },
    )

    return state
