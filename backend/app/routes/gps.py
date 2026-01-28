import json

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.rate_limiter import limiter
from app.models import Project, ProjectGPS, User
from app.websocket import log_activity

router = APIRouter()


class LatLng(BaseModel):
    lat: float
    lng: float


class PolyShape(BaseModel):
    points: list[LatLng]
    closed: bool = False


class GPSState(BaseModel):
    work: PolyShape | None = None
    sites: list[PolyShape] = []


@router.get("/projects/{project_id}/gps", response_model=GPSState)
def get_project_gps(project_id: str, db: Session = Depends(get_db)):
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
@limiter.limit(settings.RATE_LIMIT_WRITE)
async def put_project_gps(
    request: Request,
    project_id: str,
    state: GPSState,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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
