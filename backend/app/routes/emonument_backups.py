"""Maintainer-only endpoints for scheduled database backups."""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.backup_service import BackupRecord, backup_service
from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User

router = APIRouter(prefix="/emonument-dashboard/backups", tags=["eMonument Backups"])


class BackupItemResponse(BaseModel):
    backup_id: str
    created_at: str
    trigger: str
    sql_size_bytes: int
    database_names: list[str]
    storage_bucket_names: list[str]
    storage_object_count: int
    stats: dict[str, int]


class BackupListResponse(BaseModel):
    last_backup_at: str | None
    retention_limit: int
    backups: list[BackupItemResponse]


class BackupRunResponse(BaseModel):
    message: str
    backup: BackupItemResponse


class BackupRestoreResponse(BaseModel):
    message: str
    restored_backup_id: str
    restored_backup_created_at: str


class BackupDiffResponse(BaseModel):
    backup_id: str
    backup_created_at: str
    backup_stats: dict[str, int]
    live_stats: dict[str, int]
    differences: dict[str, dict[str, int]]


class BackupScheduleResponse(BaseModel):
    enabled: bool
    interval_minutes: int
    last_backup_at: str | None
    next_backup_at: str | None
    seconds_until_next_backup: int | None


def _assert_maintainer(user: User) -> None:
    if not bool(getattr(user, "is_maintainer", False)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the maintainer account can manage backups",
        )


def _to_response_item(record: BackupRecord) -> BackupItemResponse:
    return BackupItemResponse(
        backup_id=record.backup_id,
        created_at=record.created_at,
        trigger=record.trigger,
        sql_size_bytes=record.sql_size_bytes,
        database_names=record.database_names,
        storage_bucket_names=record.storage_bucket_names,
        storage_object_count=record.storage_object_count,
        stats=record.stats,
    )


@router.get("", response_model=BackupListResponse)
async def list_backups(current_user: User = Depends(get_current_user)):
    _assert_maintainer(current_user)
    records = backup_service.list_backups()
    return BackupListResponse(
        last_backup_at=records[0].created_at if records else None,
        retention_limit=settings.BACKUP_RETENTION_COUNT,
        backups=[_to_response_item(record) for record in records],
    )


@router.post("/run", response_model=BackupRunResponse)
async def run_backup_now(current_user: User = Depends(get_current_user)):
    _assert_maintainer(current_user)
    try:
        record = await asyncio.to_thread(backup_service.create_backup, "manual")
        backup_service.reset_schedule_from_now()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Backup failed: {exc}",
        )

    return BackupRunResponse(
        message="Backup created",
        backup=_to_response_item(record),
    )


@router.get("/schedule", response_model=BackupScheduleResponse)
async def get_backup_schedule(current_user: User = Depends(get_current_user)):
    _assert_maintainer(current_user)
    return BackupScheduleResponse(**backup_service.get_schedule_status())


@router.get("/{backup_id}/diff", response_model=BackupDiffResponse)
async def diff_backup(
    backup_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _assert_maintainer(current_user)
    try:
        data = backup_service.diff_with_live(backup_id, db)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Backup not found"
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not compute backup diff: {exc}",
        )

    return BackupDiffResponse(**data)


@router.post("/{backup_id}/restore", response_model=BackupRestoreResponse)
async def restore_backup(
    backup_id: str,
    current_user: User = Depends(get_current_user),
):
    _assert_maintainer(current_user)
    try:
        record = await asyncio.to_thread(backup_service.restore_backup, backup_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Backup not found"
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Restore failed: {exc}",
        )

    return BackupRestoreResponse(
        message="Database restored from backup",
        restored_backup_id=record.backup_id,
        restored_backup_created_at=record.created_at,
    )
