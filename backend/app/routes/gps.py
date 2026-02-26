"""
GPS coordinate management API routes.

Handles reading and updating GPS coordinates (work areas and excavation
site polygons) for archaeological projects.

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

import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
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
def get_project_gps(project_id: str, db: Session = Depends(get_db)):
    """Retrieve the GPS coordinate state for a project.

    Args:
        project_id: The project UUID.
        db: Database session.

    Returns:
        GPSState with the current work area and site polygons.

    Raises:
        HTTPException: 404 if the project does not exist.
    """
    # Validate project exists
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

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

    row = db.query(ProjectGPS).filter(ProjectGPS.project_id == project_id).first()
    payload = state.model_dump()
    data_str = json.dumps(payload)
    if row:
        row.data = data_str
    else:
        row = ProjectGPS(project_id=project_id, data=data_str)
        db.add(row)
    db.commit()

    # Log activity for timeline
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
