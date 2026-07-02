"""
AI-powered project summary routes.

GET  /projects/{project_id}/ai-summary  — Fetch stored AI summary + change count.
POST /projects/{project_id}/ai-summary  — Generate new summary, persist it, return result.

POST is rate-limited to 10 requests per minute per IP.
"""

from datetime import datetime

import anthropic
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy import select as sa_select
from sqlalchemy.orm import Session

from app.ai_prompts import PROMPT_PROJECT_SUMMARY
from app.ai_service import CLAUDE_HAIKU, generate_summary
from app.config import settings
from app.database import get_db
from app.dependencies import check_project_permission, get_current_user
from app.middleware import get_logger
from app.models import (
    Note,
    Project,
    ProjectActivity,
    ProjectAISummary,
    User,
    project_members,
)
from app.rate_limiter import limiter

logger = get_logger(__name__)
router = APIRouter(prefix="/projects", tags=["ai"])


class AISummaryResponse(BaseModel):
    summary: str | None = None
    provider: str | None = None
    generated_at: str | None = None
    changes_since: int = 0
    threshold: int
    can_refresh: bool


def _changes_since(db: Session, project_id: str, since: datetime | None) -> int:
    q = db.query(func.count(ProjectActivity.id)).filter(
        ProjectActivity.project_id == project_id
    )
    if since:
        q = q.filter(ProjectActivity.created_at > since)
    return q.scalar() or 0


def _build_response(stored: ProjectAISummary | None, changes: int) -> AISummaryResponse:
    threshold = settings.AI_SUMMARY_CHANGE_THRESHOLD
    return AISummaryResponse(
        summary=stored.summary if stored else None,
        provider=stored.provider if stored else None,
        generated_at=stored.generated_at.isoformat() if stored else None,
        changes_since=changes,
        threshold=threshold,
        can_refresh=stored is None or changes >= threshold,
    )


@router.get("/{project_id}/ai-summary", response_model=AISummaryResponse)
async def get_project_summary(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the stored AI summary for this (project, user) pair and the change count."""
    check_project_permission(project_id, current_user, db)

    stored = (
        db.query(ProjectAISummary)
        .filter_by(project_id=project_id, user_id=current_user.id)
        .first()
    )
    changes = _changes_since(db, project_id, stored.generated_at if stored else None)
    return _build_response(stored, changes)


@router.post("/{project_id}/ai-summary", response_model=AISummaryResponse)
@limiter.limit("10 per minute")
async def generate_project_summary(
    request: Request,
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate an AI summary, persist it per user, and return the result."""
    check_project_permission(project_id, current_user, db)

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    notes = (
        db.query(Note)
        .filter(Note.project_id == project_id)
        .order_by(Note.created_at.desc())
        .limit(20)
        .all()
    )
    activities = (
        db.query(ProjectActivity)
        .filter(ProjectActivity.project_id == project_id)
        .order_by(ProjectActivity.created_at.desc())
        .limit(30)
        .all()
    )
    member_rows = db.execute(
        sa_select(project_members).where(project_members.c.project_id == project_id)
    ).fetchall()

    notes_text = "\n".join(
        f"- {n.title}" + (f": {n.content[:200]}" if n.content else "") for n in notes
    ) or "No notes recorded yet."

    activities_text = (
        "\n".join(f"- {a.description}" for a in activities) or "No recent activity."
    )

    prompt = PROMPT_PROJECT_SUMMARY.format(
        project_name=project.name,
        lmi_line=f"LMI Code: {project.ran_lmi_id}\n" if project.ran_lmi_id else "",
        description=project.description or "No description provided.",
        member_count=len(member_rows),
        visibility="Public" if project.is_public else "Private",
        note_count=len(notes),
        notes_text=notes_text,
        activity_count=len(activities),
        activities_text=activities_text,
    )

    try:
        summary_text, provider = await generate_summary(prompt, model=CLAUDE_HAIKU)
        summary_text = summary_text.replace("—", ", ")
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except (anthropic.APIStatusError, httpx.HTTPStatusError) as exc:
        status = (
            exc.status_code
            if isinstance(exc, anthropic.APIStatusError)
            else exc.response.status_code
        )
        logger.error("AI provider error", status=status, error=str(exc), project_id=project_id)
        if status == 429:
            raise HTTPException(
                status_code=429, detail="AI rate limit reached. Please wait and try again."
            )
        raise HTTPException(status_code=502, detail=f"AI service error: {exc}")
    except Exception as exc:
        logger.error("AI summary error", error=str(exc), project_id=project_id)
        raise HTTPException(status_code=502, detail=f"AI service error: {exc}")

    now = datetime.utcnow()
    stored = (
        db.query(ProjectAISummary)
        .filter_by(project_id=project_id, user_id=current_user.id)
        .first()
    )
    if stored:
        stored.summary = summary_text
        stored.provider = provider
        stored.generated_at = now
    else:
        stored = ProjectAISummary(
            project_id=project_id,
            user_id=current_user.id,
            summary=summary_text,
            provider=provider,
            generated_at=now,
        )
        db.add(stored)
    db.commit()
    db.refresh(stored)

    logger.info(
        "AI summary generated and saved",
        project_id=project_id,
        provider=provider,
        user_id=current_user.id,
    )
    return _build_response(stored, 0)
