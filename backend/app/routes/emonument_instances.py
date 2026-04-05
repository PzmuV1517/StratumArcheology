"""Workflow endpoints for eMonument instances and version history."""

from datetime import datetime

import firebase_admin.auth as firebase_auth
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth_provider import (
    choose_primary_auth_provider,
    extract_provider_ids_from_firebase_user,
    is_google_provider,
)
from app.database import get_db
from app.dependencies import get_current_user
from app.emonument_form_schema import schema_to_dict
from app.emonument_validation import validate_fisa_payload
from app.middleware import get_logger
from app.models import (
    FisaInstance,
    FisaInstanceStatus,
    FisaInstanceVersion,
    Monument,
    User,
)

router = APIRouter(prefix="/emonument", tags=["eMonument Workflow"])
logger = get_logger(__name__)


class FisaCreateRequest(BaseModel):
    device_id: str | None = None
    data: dict = {}


class FisaUpdateRequest(BaseModel):
    data: dict
    status: FisaInstanceStatus | None = None


class ReturnRequest(BaseModel):
    reason: str


class ValidatePayloadRequest(BaseModel):
    data: dict
    strict: bool = False


class ValidationIssueResponse(BaseModel):
    path: str
    code: str
    message: str


class ValidationResponse(BaseModel):
    valid: bool
    errors: list[ValidationIssueResponse]


class FisaResponse(BaseModel):
    id: str
    monument_id: str
    user_id: str | None
    device_id: str | None
    status: FisaInstanceStatus
    data: dict
    version: int
    rejection_reason: str | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FisaVersionResponse(BaseModel):
    id: str
    fisa_instance_id: str
    version: int
    status: FisaInstanceStatus
    data: dict
    rejection_reason: str | None
    changed_by: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class MonumentResponse(BaseModel):
    id: str
    lmi_code: str
    name: str
    county: str | None
    locality: str | None
    address: str | None
    latitude: str | None
    longitude: str | None
    status: str | None

    class Config:
        from_attributes = True


@router.get("/form-schema")
async def get_form_schema(
    current_user: User = Depends(get_current_user),
):
    """Expose eMonument form schema used by mobile/web clients."""
    _assert_collect_access(current_user)
    return {"sections": schema_to_dict()}


@router.post("/validate", response_model=ValidationResponse)
async def validate_form_payload(
    request: ValidatePayloadRequest,
    current_user: User = Depends(get_current_user),
):
    """Validate an arbitrary eMonument payload with optional strict mode."""
    _assert_collect_access(current_user)
    issues = validate_fisa_payload(request.data, strict=request.strict)
    return ValidationResponse(
        valid=not issues,
        errors=[
            ValidationIssueResponse(path=i.path, code=i.code, message=i.message)
            for i in issues
        ],
    )


def _is_maintainer(user: User) -> bool:
    return bool(getattr(user, "is_maintainer", False))


def _resolve_auth_provider(user: User, db: Session) -> str | None:
    if _is_maintainer(user):
        return "maintainer"

    if user.auth_provider:
        return user.auth_provider

    try:
        firebase_user = firebase_auth.get_user(user.firebase_uid)
        resolved_provider = choose_primary_auth_provider(
            extract_provider_ids_from_firebase_user(firebase_user)
        )
        if resolved_provider and user.auth_provider != resolved_provider:
            user.auth_provider = resolved_provider
            db.commit()
    except Exception as exc:
        logger.warning(
            "Failed to reconcile auth provider for eMonument access",
            user_id=user.id,
            firebase_uid=user.firebase_uid,
            error=str(exc),
        )

    return user.auth_provider


def _can_review(user: User, db: Session) -> bool:
    if _is_maintainer(user):
        return True
    if not bool(user.is_dashboard_admin):
        return False
    return not is_google_provider(_resolve_auth_provider(user, db))


def _can_collect(user: User) -> bool:
    return _is_maintainer(user) or bool(user.is_emonument_privileged)


def _assert_collect_access(user: User) -> None:
    if not _can_collect(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only eMonument privileged users can create/update field instances",
        )


def _assert_review_access(user: User, db: Session) -> None:
    if not _can_review(user, db):
        detail = "Only dashboard admins or maintainer can review instances"
        if is_google_provider(_resolve_auth_provider(user, db)):
            detail = "Google-authenticated accounts cannot access dashboard review workflows"
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
        )


def _assert_instance_access(user: User, instance: FisaInstance, db: Session) -> None:
    if _can_review(user, db) or _is_maintainer(user):
        return
    if instance.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot access this instance",
        )


def _snapshot(db: Session, instance: FisaInstance, changed_by: str | None) -> None:
    snapshot = FisaInstanceVersion(
        fisa_instance_id=instance.id,
        version=instance.version,
        status=instance.status,
        data=instance.data,
        rejection_reason=instance.rejection_reason,
        changed_by=changed_by,
        created_at=datetime.utcnow(),
    )
    db.add(snapshot)


@router.get("/monuments", response_model=list[MonumentResponse])
async def list_monuments(
    q: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List monuments (scope: all for maintainers/admins, allocated for field users)."""
    query = db.query(Monument)

    if q:
        like_q = f"%{q}%"
        query = query.filter(
            (Monument.lmi_code.ilike(like_q))
            | (Monument.name.ilike(like_q))
            | (Monument.locality.ilike(like_q))
            | (Monument.county.ilike(like_q))
        )

    if not _can_review(current_user, db):
        _assert_collect_access(current_user)
        query = (
            query.join(Monument.instances, isouter=True)
            .filter((FisaInstance.user_id == current_user.id) | (FisaInstance.id.is_(None)))
            .distinct()
        )

    monuments = query.order_by(Monument.lmi_code.asc()).all()
    return [MonumentResponse.model_validate(m) for m in monuments]


@router.get("/instances", response_model=list[FisaResponse])
async def list_instances(
    status_filter: FisaInstanceStatus | None = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(FisaInstance)

    if status_filter is not None:
        query = query.filter(FisaInstance.status == status_filter)

    if not _can_review(current_user, db):
        _assert_collect_access(current_user)
        query = query.filter(FisaInstance.user_id == current_user.id)

    instances = query.order_by(FisaInstance.updated_at.desc()).all()
    return [FisaResponse.model_validate(i) for i in instances]


@router.post("/instances", response_model=FisaResponse)
async def create_instance(
    request: FisaCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _assert_collect_access(current_user)

    issues = validate_fisa_payload(request.data, strict=False)
    if issues:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "Payload validation failed",
                "errors": [
                    {"path": i.path, "code": i.code, "message": i.message}
                    for i in issues
                ],
            },
        )

    monument = db.query(Monument).order_by(Monument.id.asc()).first()
    if not monument:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No monument records configured",
        )

    instance = FisaInstance(
        monument_id=monument.id,
        user_id=None if _is_maintainer(current_user) else current_user.id,
        device_id=request.device_id,
        status=FisaInstanceStatus.DRAFT,
        data=request.data,
        version=1,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(instance)
    db.flush()

    _snapshot(db, instance, None if _is_maintainer(current_user) else current_user.id)

    db.commit()
    db.refresh(instance)
    return FisaResponse.model_validate(instance)


@router.patch("/instances/{instance_id}", response_model=FisaResponse)
async def update_instance(
    instance_id: str,
    request: FisaUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _assert_collect_access(current_user)

    issues = validate_fisa_payload(request.data, strict=False)
    if issues:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "Payload validation failed",
                "errors": [
                    {"path": i.path, "code": i.code, "message": i.message}
                    for i in issues
                ],
            },
        )

    instance = db.query(FisaInstance).filter(FisaInstance.id == instance_id).first()
    if not instance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")

    _assert_instance_access(current_user, instance, db)

    if instance.status in {
        FisaInstanceStatus.IN_VERIFICARE,
        FisaInstanceStatus.IN_APROBARE,
        FisaInstanceStatus.VALIDAT,
    }:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Instance cannot be edited in its current status",
        )

    instance.data = request.data
    if request.status is not None:
        if request.status not in {
            FisaInstanceStatus.DRAFT,
            FisaInstanceStatus.COMPLETAT,
            FisaInstanceStatus.FINALIZAT,
        }:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Collectors can only set status to draft, completat or finalizat",
            )
        instance.status = request.status
    instance.version += 1
    instance.updated_at = datetime.utcnow()

    _snapshot(db, instance, None if _is_maintainer(current_user) else current_user.id)

    db.commit()
    db.refresh(instance)
    return FisaResponse.model_validate(instance)


@router.post("/instances/{instance_id}/submit", response_model=FisaResponse)
async def submit_for_verification(
    instance_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _assert_collect_access(current_user)

    instance = db.query(FisaInstance).filter(FisaInstance.id == instance_id).first()
    if not instance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")

    _assert_instance_access(current_user, instance, db)

    issues = validate_fisa_payload(instance.data or {}, strict=True)
    if issues:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "Submission blocked by strict validation",
                "errors": [
                    {"path": i.path, "code": i.code, "message": i.message}
                    for i in issues
                ],
            },
        )

    if instance.status not in {
        FisaInstanceStatus.COMPLETAT,
        FisaInstanceStatus.FINALIZAT,
        FisaInstanceStatus.REINTORS,
    }:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Submission allowed only from COMPLETAT, FINALIZAT or REINTORS",
        )

    instance.status = FisaInstanceStatus.IN_VERIFICARE
    instance.rejection_reason = None
    instance.version += 1
    instance.updated_at = datetime.utcnow()

    _snapshot(db, instance, None if _is_maintainer(current_user) else current_user.id)

    db.commit()
    db.refresh(instance)
    return FisaResponse.model_validate(instance)


@router.post("/instances/{instance_id}/to-approval", response_model=FisaResponse)
async def send_to_approval(
    instance_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _assert_review_access(current_user, db)

    instance = db.query(FisaInstance).filter(FisaInstance.id == instance_id).first()
    if not instance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")

    if instance.status != FisaInstanceStatus.IN_VERIFICARE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only IN_VERIFICARE instances can be sent to approval",
        )

    instance.status = FisaInstanceStatus.IN_APROBARE
    instance.version += 1
    instance.updated_at = datetime.utcnow()

    _snapshot(db, instance, None if _is_maintainer(current_user) else current_user.id)

    db.commit()
    db.refresh(instance)
    return FisaResponse.model_validate(instance)


@router.post("/instances/{instance_id}/approve", response_model=FisaResponse)
async def approve_instance(
    instance_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _assert_review_access(current_user, db)

    instance = db.query(FisaInstance).filter(FisaInstance.id == instance_id).first()
    if not instance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")

    if instance.status != FisaInstanceStatus.IN_APROBARE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only IN_APROBARE instances can be approved",
        )

    instance.status = FisaInstanceStatus.VALIDAT
    instance.rejection_reason = None
    instance.version += 1
    instance.updated_at = datetime.utcnow()

    _snapshot(db, instance, None if _is_maintainer(current_user) else current_user.id)

    db.commit()
    db.refresh(instance)
    return FisaResponse.model_validate(instance)


@router.post("/instances/{instance_id}/return", response_model=FisaResponse)
async def return_instance(
    instance_id: str,
    request: ReturnRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _assert_review_access(current_user, db)

    instance = db.query(FisaInstance).filter(FisaInstance.id == instance_id).first()
    if not instance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")

    if instance.status not in {FisaInstanceStatus.IN_VERIFICARE, FisaInstanceStatus.IN_APROBARE}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only IN_VERIFICARE or IN_APROBARE instances can be returned",
        )

    reason = request.reason.strip()
    if not reason:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Return reason is required",
        )

    instance.status = FisaInstanceStatus.REINTORS
    instance.rejection_reason = reason
    instance.version += 1
    instance.updated_at = datetime.utcnow()

    _snapshot(db, instance, None if _is_maintainer(current_user) else current_user.id)

    db.commit()
    db.refresh(instance)
    return FisaResponse.model_validate(instance)


@router.get("/instances/{instance_id}/versions", response_model=list[FisaVersionResponse])
async def list_instance_versions(
    instance_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    instance = db.query(FisaInstance).filter(FisaInstance.id == instance_id).first()
    if not instance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")

    _assert_instance_access(current_user, instance, db)

    versions = (
        db.query(FisaInstanceVersion)
        .filter(FisaInstanceVersion.fisa_instance_id == instance_id)
        .order_by(FisaInstanceVersion.version.desc())
        .all()
    )
    return [FisaVersionResponse.model_validate(v) for v in versions]


@router.delete("/instances/{instance_id}")
async def delete_instance(
    instance_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a form instance and all its version snapshots."""
    instance = db.query(FisaInstance).filter(FisaInstance.id == instance_id).first()
    if not instance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")

    _assert_instance_access(current_user, instance, db)

    db.delete(instance)
    db.commit()

    return {"message": "Instance deleted", "id": instance_id}
