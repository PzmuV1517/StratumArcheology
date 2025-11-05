from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional, Any, Dict
import json

from app.database import get_db
from app.models import Project, ProjectGPS

router = APIRouter()


class LatLng(BaseModel):
    lat: float
    lng: float


class PolyShape(BaseModel):
    points: List[LatLng]
    closed: bool = False


class GPSState(BaseModel):
    work: Optional[PolyShape] = None
    sites: List[PolyShape] = []


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
def put_project_gps(project_id: str, state: GPSState, db: Session = Depends(get_db)):
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
    return state
