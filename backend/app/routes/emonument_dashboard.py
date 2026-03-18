"""Dashboard endpoints for eMonument user administration.

Permission model:
- Maintainer: can manage all STRATUM accounts.
- Dashboard admins: can manage only eMonument-privileged accounts.
"""

import re
import uuid
from datetime import datetime

import firebase_admin.auth as firebase_auth
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.middleware import get_logger
from app.models import User

logger = get_logger(__name__)
router = APIRouter(prefix="/emonument-dashboard", tags=["eMonument Dashboard"])

FIREBASE_SEND_OOB_URL = (
    "https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode"
)


class DashboardUserResponse(BaseModel):
    id: str
    email: EmailStr
    username: str | None = None
    display_name: str | None = None
    firebase_uid: str
    is_emonument_privileged: bool
    is_dashboard_admin: bool
    created_at: datetime
    last_login: datetime | None = None

    class Config:
        from_attributes = True


class DashboardCreateUserRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: str
    username: str | None = None
    is_emonument_privileged: bool = True
    is_dashboard_admin: bool = False


class DashboardUpdateUserRequest(BaseModel):
    display_name: str | None = None
    username: str | None = None
    is_emonument_privileged: bool | None = None
    is_dashboard_admin: bool | None = None


def _is_maintainer(user: User) -> bool:
    return bool(getattr(user, "is_maintainer", False))


def _assert_dashboard_actor(user: User) -> None:
    if _is_maintainer(user):
        return
    if not user.is_dashboard_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only dashboard admins or maintainer can perform this action",
        )


def _assert_target_scope(actor: User, target: User) -> None:
    if _is_maintainer(actor):
        return
    if not target.is_emonument_privileged:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dashboard admins can manage only eMonument-privileged accounts",
        )


@router.get("/users", response_model=list[DashboardUserResponse])
async def list_dashboard_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List users available in dashboard scope."""
    _assert_dashboard_actor(current_user)

    query = db.query(User)
    if not _is_maintainer(current_user):
        query = query.filter(User.is_emonument_privileged.is_(True))

    users = query.order_by(User.created_at.desc()).all()
    return [DashboardUserResponse.model_validate(u) for u in users]


@router.post("/users", response_model=DashboardUserResponse)
async def create_dashboard_user(
    request: DashboardCreateUserRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a STRATUM account with optional eMonument/dashboard privileges."""
    _assert_dashboard_actor(current_user)

    if db.query(User).filter(User.email == request.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    username = request.username.strip().lower() if request.username else None
    if username:
        if len(username) < 3 or len(username) > 30:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username must be 3-30 characters",
            )
        if not re.match(r"^[a-z0-9_.-]+$", username):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username can only contain lowercase letters, numbers, dots, hyphens, and underscores",
            )
        if db.query(User).filter(User.username == username).first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken",
            )

    is_emonument_privileged = request.is_emonument_privileged
    is_dashboard_admin = request.is_dashboard_admin

    # Dashboard admins are restricted to privileged accounts only.
    if not _is_maintainer(current_user):
        if not is_emonument_privileged:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Dashboard admins can only create eMonument-privileged accounts",
            )

    if is_dashboard_admin:
        is_emonument_privileged = True

    try:
        firebase_user = firebase_auth.create_user(
            email=request.email,
            password=request.password,
            display_name=request.display_name,
        )
    except firebase_auth.EmailAlreadyExistsError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered in Firebase",
        )
    except Exception as exc:
        logger.exception("Failed to create Firebase user", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create Firebase user",
        )

    user = User(
        id=str(uuid.uuid4()),
        firebase_uid=firebase_user.uid,
        email=request.email,
        username=username,
        display_name=request.display_name,
        is_emonument_privileged=is_emonument_privileged,
        is_dashboard_admin=is_dashboard_admin,
        created_at=datetime.utcnow(),
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return DashboardUserResponse.model_validate(user)


@router.patch("/users/{user_id}", response_model=DashboardUserResponse)
async def update_dashboard_user(
    user_id: str,
    request: DashboardUpdateUserRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update dashboard-manageable user fields and privileges."""
    _assert_dashboard_actor(current_user)

    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    _assert_target_scope(current_user, target)

    if request.display_name is not None:
        target.display_name = request.display_name

    if request.username is not None:
        username = request.username.strip().lower()
        if len(username) < 3 or len(username) > 30:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username must be 3-30 characters",
            )
        if not re.match(r"^[a-z0-9_.-]+$", username):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username can only contain lowercase letters, numbers, dots, hyphens, and underscores",
            )
        existing = db.query(User).filter(User.username == username, User.id != user_id).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken",
            )
        target.username = username

    if request.is_dashboard_admin is not None:
        target.is_dashboard_admin = request.is_dashboard_admin

    if request.is_emonument_privileged is not None:
        if not _is_maintainer(current_user) and not request.is_emonument_privileged:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Dashboard admins cannot remove eMonument privilege",
            )
        target.is_emonument_privileged = request.is_emonument_privileged

    # Any dashboard admin account must remain privileged.
    if target.is_dashboard_admin:
        target.is_emonument_privileged = True

    db.commit()
    db.refresh(target)
    return DashboardUserResponse.model_validate(target)


@router.post("/users/{user_id}/password-reset")
async def send_password_reset_email(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send Firebase password reset email for a managed user."""
    _assert_dashboard_actor(current_user)

    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    _assert_target_scope(current_user, target)

    async with httpx.AsyncClient() as client:
        response = await client.post(
            FIREBASE_SEND_OOB_URL,
            params={"key": settings.FIREBASE_WEB_API_KEY},
            json={"requestType": "PASSWORD_RESET", "email": target.email},
            timeout=10.0,
        )

    if response.status_code != 200:
        logger.warning(
            "Failed Firebase password reset",
            target_user_id=target.id,
            status_code=response.status_code,
            response=response.text,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Firebase password reset failed",
        )

    return {"message": "Password reset email sent", "email": target.email}
