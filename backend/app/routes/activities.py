from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.dependencies import get_current_user, check_project_permission
from app.models import User, ProjectActivity, ActivityType
from pydantic import BaseModel
from datetime import datetime

router = APIRouter(prefix="/activities", tags=["activities"])


class ActivityResponse(BaseModel):
    id: str
    project_id: str
    project_name: Optional[str] = None
    user_id: Optional[str]
    user_name: Optional[str]
    activity_type: str
    description: str
    extra_data: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


@router.get("/project/{project_id}", response_model=List[ActivityResponse])
async def get_project_activities(
    project_id: str,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get activities for a project in reverse chronological order (newest first).
    
    Args:
        project_id: The project UUID
        limit: Maximum number of activities to return (default 100, max 500)
        offset: Number of activities to skip for pagination
    """
    check_project_permission(project_id, current_user, db)
    
    activities = db.query(ProjectActivity).filter(
        ProjectActivity.project_id == project_id
    ).order_by(
        ProjectActivity.created_at.desc()
    ).limit(limit).offset(offset).all()
    
    # Enrich with user names
    result = []
    for activity in activities:
        user_name = None
        if activity.user_id:
            user = db.query(User).filter(User.id == activity.user_id).first()
            if user:
                user_name = user.display_name or user.email
        
        result.append({
            'id': activity.id,
            'project_id': activity.project_id,
            'user_id': activity.user_id,
            'user_name': user_name,
            'activity_type': activity.activity_type.value,
            'description': activity.description,
            'extra_data': activity.extra_data,
            'created_at': activity.created_at
        })
    
    return result


@router.get("/me", response_model=List[ActivityResponse])
async def get_my_activities(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all activities performed by the current user across all their projects.
    
    Returns activities in reverse chronological order (newest first).
    This is useful for showing the user their personal activity timeline.
    
    Args:
        limit: Maximum number of activities to return (default 50, max 200)
        offset: Number of activities to skip for pagination
    """
    from app.models import Project, project_members
    
    # Get all project IDs where user is a member
    user_project_ids = db.query(project_members.c.project_id).filter(
        project_members.c.user_id == current_user.id
    ).all()
    project_ids = [p[0] for p in user_project_ids]
    
    if not project_ids:
        return []
    
    # Get activities by this user in their projects
    activities = db.query(ProjectActivity).filter(
        ProjectActivity.user_id == current_user.id,
        ProjectActivity.project_id.in_(project_ids)
    ).order_by(
        ProjectActivity.created_at.desc()
    ).limit(limit).offset(offset).all()
    
    # Get project names for each activity
    projects = db.query(Project).filter(Project.id.in_(project_ids)).all()
    project_names = {p.id: p.name for p in projects}
    
    result = []
    for activity in activities:
        result.append({
            'id': activity.id,
            'project_id': activity.project_id,
            'project_name': project_names.get(activity.project_id, 'Unknown'),
            'user_id': activity.user_id,
            'user_name': current_user.display_name or current_user.email,
            'activity_type': activity.activity_type.value,
            'description': activity.description,
            'extra_data': activity.extra_data,
            'created_at': activity.created_at
        })
    
    return result
