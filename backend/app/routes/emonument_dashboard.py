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
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.middleware import get_logger
from app.models import FisaInstance, Monument, User

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
    is_account_disabled: bool
    is_soft_deleted: bool
    soft_deleted_at: datetime | None = None
    email_verified: bool | None = None
    firebase_disabled: bool | None = None
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
    email: EmailStr | None = None
    display_name: str | None = None
    username: str | None = None
    is_emonument_privileged: bool | None = None
    is_dashboard_admin: bool | None = None


class DashboardHardDeleteUserRequest(BaseModel):
    confirmation_text: str


class DashboardMonumentResponse(BaseModel):
    id: str
    lmi_code: str
    name: str
    county: str | None = None
    locality: str | None = None
    address: str | None = None
    latitude: str | None = None
    longitude: str | None = None
    status: str | None = None

    class Config:
        from_attributes = True


class DashboardCreateMonumentRequest(BaseModel):
    lmi_code: str
    name: str
    county: str | None = None
    locality: str | None = None
    address: str | None = None
    latitude: str | None = None
    longitude: str | None = None
    status: str | None = None


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


def _get_firebase_status(firebase_uid: str) -> tuple[bool | None, bool | None]:
    """Return Firebase email-verified and disabled flags for a Firebase UID."""
    try:
        firebase_user = firebase_auth.get_user(firebase_uid)
        return firebase_user.email_verified, firebase_user.disabled
    except Exception as exc:
        logger.warning(
            "Failed to fetch Firebase status",
            firebase_uid=firebase_uid,
            error=str(exc),
        )
        return None, None


def _serialize_dashboard_user(user: User) -> DashboardUserResponse:
    email_verified, firebase_disabled = _get_firebase_status(user.firebase_uid)
    return DashboardUserResponse(
        id=user.id,
        email=user.email,
        username=user.username,
        display_name=user.display_name,
        firebase_uid=user.firebase_uid,
        is_emonument_privileged=user.is_emonument_privileged,
        is_dashboard_admin=user.is_dashboard_admin,
        is_account_disabled=user.is_account_disabled,
        is_soft_deleted=user.is_soft_deleted,
        soft_deleted_at=user.soft_deleted_at,
        email_verified=email_verified,
        firebase_disabled=firebase_disabled,
        created_at=user.created_at,
        last_login=user.last_login,
    )


async def _send_firebase_oob_email(request_type: str, email: str) -> httpx.Response:
    """Send Firebase email actions via Identity Toolkit (password reset, verification)."""
    async with httpx.AsyncClient() as client:
        return await client.post(
            FIREBASE_SEND_OOB_URL,
            params={"key": settings.FIREBASE_WEB_API_KEY},
            json={"requestType": request_type, "email": email},
            timeout=10.0,
        )


@router.get("/users", response_model=list[DashboardUserResponse])
async def list_dashboard_users(
    q: str | None = Query(None),
    include_soft_deleted: bool = Query(True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List users available in dashboard scope."""
    _assert_dashboard_actor(current_user)

    query = db.query(User)
    if not _is_maintainer(current_user):
        query = query.filter(User.is_emonument_privileged.is_(True))

    if not include_soft_deleted:
        query = query.filter(User.is_soft_deleted.is_(False))

    if q:
        like_q = f"%{q.strip()}%"
        query = query.filter(
            (User.email.ilike(like_q))
            | (User.display_name.ilike(like_q))
            | (User.username.ilike(like_q))
        )

    users = query.order_by(User.created_at.desc()).all()
    return [_serialize_dashboard_user(u) for u in users]


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

    if is_dashboard_admin and not _is_maintainer(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only maintainer can grant dashboard admin",
        )

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
        firebase_auth.update_user(
            firebase_user.uid, email_verified=True, disabled=False
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
        is_account_disabled=False,
        is_soft_deleted=False,
        soft_deleted_at=None,
        created_at=datetime.utcnow(),
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return _serialize_dashboard_user(user)


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

    firebase_updates: dict[str, str] = {}

    if request.email is not None:
        email = request.email.strip().lower()
        existing_email = (
            db.query(User).filter(User.email == email, User.id != user_id).first()
        )
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )
        target.email = email
        firebase_updates["email"] = email

    if request.display_name is not None:
        target.display_name = request.display_name
        firebase_updates["display_name"] = request.display_name

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
        existing = (
            db.query(User)
            .filter(User.username == username, User.id != user_id)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken",
            )
        target.username = username

    if request.is_dashboard_admin is not None:
        if not _is_maintainer(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only maintainer can update dashboard admin status",
            )
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

    if firebase_updates:
        try:
            firebase_auth.update_user(target.firebase_uid, **firebase_updates)
        except firebase_auth.EmailAlreadyExistsError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered in Firebase",
            )
        except Exception as exc:
            logger.exception(
                "Failed to update Firebase user",
                target_user_id=target.id,
                error=str(exc),
            )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Failed to update Firebase user",
            )

    db.commit()
    db.refresh(target)
    return _serialize_dashboard_user(target)


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

    if target.is_soft_deleted:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot send password reset for deleted account",
        )

    response = await _send_firebase_oob_email("PASSWORD_RESET", target.email)

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


@router.post("/users/{user_id}/verification-email")
async def send_verification_email(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send or generate a Firebase verification link for a managed user."""
    _assert_dashboard_actor(current_user)

    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    _assert_target_scope(current_user, target)

    if target.is_soft_deleted:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot send verification for deleted account",
        )

    response = await _send_firebase_oob_email("VERIFY_EMAIL", target.email)
    if response.status_code == 200:
        return {
            "message": "Verification email sent",
            "email": target.email,
            "sent": True,
        }

    logger.warning(
        "Failed Firebase verification email via sendOobCode; falling back to generated link",
        target_user_id=target.id,
        status_code=response.status_code,
        response=response.text,
    )

    try:
        link = firebase_auth.generate_email_verification_link(target.email)
    except Exception as exc:
        logger.exception(
            "Failed to generate Firebase verification link",
            target_user_id=target.id,
            error=str(exc),
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Firebase verification email failed",
        )

    return {
        "message": "Verification link generated. Share it with the user.",
        "email": target.email,
        "sent": False,
        "verification_link": link,
    }


@router.post("/users/{user_id}/disable", response_model=DashboardUserResponse)
async def disable_dashboard_user(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Disable a managed account in both local DB and Firebase."""
    _assert_dashboard_actor(current_user)

    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    _assert_target_scope(current_user, target)

    try:
        firebase_auth.update_user(target.firebase_uid, disabled=True)
    except Exception as exc:
        logger.exception(
            "Failed to disable Firebase user",
            target_user_id=target.id,
            error=str(exc),
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to disable Firebase user",
        )

    target.is_account_disabled = True
    db.commit()
    db.refresh(target)
    return _serialize_dashboard_user(target)


@router.post("/users/{user_id}/enable", response_model=DashboardUserResponse)
async def enable_dashboard_user(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Enable a managed account in both local DB and Firebase."""
    _assert_dashboard_actor(current_user)

    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    _assert_target_scope(current_user, target)

    if target.is_soft_deleted:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Restore account before enabling",
        )

    try:
        firebase_auth.update_user(target.firebase_uid, disabled=False)
    except Exception as exc:
        logger.exception(
            "Failed to enable Firebase user",
            target_user_id=target.id,
            error=str(exc),
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to enable Firebase user",
        )

    target.is_account_disabled = False
    db.commit()
    db.refresh(target)
    return _serialize_dashboard_user(target)


@router.post("/users/{user_id}/soft-delete", response_model=DashboardUserResponse)
async def soft_delete_dashboard_user(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Soft-delete account locally and disable it in Firebase."""
    _assert_dashboard_actor(current_user)

    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    _assert_target_scope(current_user, target)

    try:
        firebase_auth.update_user(target.firebase_uid, disabled=True)
    except Exception as exc:
        logger.exception(
            "Failed to disable Firebase user during soft-delete",
            target_user_id=target.id,
            error=str(exc),
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to disable Firebase user",
        )

    target.is_soft_deleted = True
    target.soft_deleted_at = datetime.utcnow()
    target.is_account_disabled = True
    db.commit()
    db.refresh(target)
    return _serialize_dashboard_user(target)


@router.post("/users/{user_id}/restore", response_model=DashboardUserResponse)
async def restore_dashboard_user(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Restore a soft-deleted account and re-enable it in Firebase."""
    _assert_dashboard_actor(current_user)

    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    _assert_target_scope(current_user, target)

    try:
        firebase_auth.update_user(target.firebase_uid, disabled=False)
    except Exception as exc:
        logger.exception(
            "Failed to re-enable Firebase user during restore",
            target_user_id=target.id,
            error=str(exc),
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to enable Firebase user",
        )

    target.is_soft_deleted = False
    target.soft_deleted_at = None
    target.is_account_disabled = False
    db.commit()
    db.refresh(target)
    return _serialize_dashboard_user(target)


@router.post("/users/{user_id}/hard-delete")
async def hard_delete_dashboard_user(
    user_id: str,
    request: DashboardHardDeleteUserRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Permanently delete an account from Firebase and local database."""
    _assert_dashboard_actor(current_user)

    if request.confirmation_text.strip().upper() != "HARD DELETE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Hard delete confirmation phrase mismatch",
        )

    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    _assert_target_scope(current_user, target)

    try:
        firebase_auth.delete_user(target.firebase_uid)
    except firebase_auth.UserNotFoundError:
        logger.warning(
            "Firebase user already missing during hard-delete",
            target_user_id=target.id,
            firebase_uid=target.firebase_uid,
        )
    except Exception as exc:
        logger.exception(
            "Failed to hard-delete Firebase user",
            target_user_id=target.id,
            error=str(exc),
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to hard-delete Firebase user",
        )

    target_email = target.email
    db.delete(target)
    db.commit()

    return {
        "message": "User hard-deleted",
        "id": user_id,
        "email": target_email,
    }


@router.get("/monuments", response_model=list[DashboardMonumentResponse])
async def list_dashboard_monuments(
    q: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List monuments for dashboard management."""
    _assert_dashboard_actor(current_user)

    query = db.query(Monument)
    if q:
        like_q = f"%{q}%"
        query = query.filter(
            (Monument.lmi_code.ilike(like_q))
            | (Monument.name.ilike(like_q))
            | (Monument.locality.ilike(like_q))
            | (Monument.county.ilike(like_q))
        )

    monuments = query.order_by(Monument.lmi_code.asc()).all()
    return [DashboardMonumentResponse.model_validate(m) for m in monuments]


@router.post("/monuments", response_model=DashboardMonumentResponse)
async def create_dashboard_monument(
    request: DashboardCreateMonumentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new monument available for eMonument forms."""
    _assert_dashboard_actor(current_user)

    lmi_code = request.lmi_code.strip()
    if not lmi_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="lmi_code is required",
        )

    if db.query(Monument).filter(Monument.lmi_code == lmi_code).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Monument with this LMI code already exists",
        )

    name = request.name.strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="name is required",
        )

    monument = Monument(
        id=str(uuid.uuid4()),
        lmi_code=lmi_code,
        name=name,
        county=request.county.strip() if request.county else None,
        locality=request.locality.strip() if request.locality else None,
        address=request.address.strip() if request.address else None,
        latitude=request.latitude.strip() if request.latitude else None,
        longitude=request.longitude.strip() if request.longitude else None,
        status=request.status.strip() if request.status else None,
    )

    db.add(monument)
    db.commit()
    db.refresh(monument)

    return DashboardMonumentResponse.model_validate(monument)


@router.delete("/monuments/{monument_id}")
async def delete_dashboard_monument(
    monument_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a monument if no forms are linked to it."""
    _assert_dashboard_actor(current_user)

    monument = db.query(Monument).filter(Monument.id == monument_id).first()
    if not monument:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Monument not found",
        )

    has_instances = (
        db.query(FisaInstance.id)
        .filter(FisaInstance.monument_id == monument_id)
        .first()
        is not None
    )
    if has_instances:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete monument with existing forms. Delete linked forms first.",
        )

    db.delete(monument)
    db.commit()

    return {"message": "Monument deleted", "id": monument_id}
