"""Database backup and restore service for maintainer operations."""

from __future__ import annotations

import asyncio
import json
import os
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from io import BytesIO
from typing import Any

from minio.commonconfig import CopySource
from minio.error import S3Error
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.middleware import get_logger
from app.minio_client import minio_client
from app.models import FileNode, FisaInstance, Monument, Note, Project, User

logger = get_logger(__name__)


@dataclass
class BackupRecord:
    backup_id: str
    created_at: str
    trigger: str
    dump_keys: list[str]
    database_names: list[str]
    storage_bucket_names: list[str]
    storage_object_count: int
    metadata_key: str
    sql_size_bytes: int
    stats: dict[str, int]


class BackupService:
    def __init__(self) -> None:
        self._task: asyncio.Task[None] | None = None
        self._wake_event: asyncio.Event | None = None
        self._last_backup_at: datetime | None = None
        self._next_backup_at: datetime | None = None
        self._pg_dump_bin = self._resolve_binary(
            preferred=settings.BACKUP_PGDUMP_BIN,
            default_name="pg_dump",
        )
        self._psql_bin = self._resolve_binary(
            preferred=settings.BACKUP_PSQL_BIN,
            default_name="psql",
        )

    def _resolve_binary(self, preferred: str, default_name: str) -> str | None:
        candidates = []

        if preferred:
            candidates.append(preferred)

        if preferred != default_name:
            candidates.append(default_name)

        # Common Homebrew/Postgres locations on macOS.
        candidates.extend(
            [
                f"/opt/homebrew/opt/libpq/bin/{default_name}",
                f"/usr/local/opt/libpq/bin/{default_name}",
                f"/opt/homebrew/bin/{default_name}",
                f"/usr/local/bin/{default_name}",
            ]
        )

        for candidate in candidates:
            if os.path.isabs(candidate) and os.path.exists(candidate):
                return candidate
            resolved = shutil.which(candidate)
            if resolved:
                return resolved

        return None

    def _require_binary(
        self, path: str | None, binary_name: str, env_name: str
    ) -> str:
        if path:
            return path

        raise RuntimeError(
            f"{binary_name} not found. Install PostgreSQL client tools and/or set "
            f"{env_name} to the full executable path."
        )

    @property
    def bucket_name(self) -> str:
        return settings.BACKUP_BUCKET_NAME

    @property
    def interval_seconds(self) -> int:
        return max(60, settings.BACKUP_INTERVAL_MINUTES * 60)

    def _touch_after_successful_backup(
        self, completed_at: datetime | None = None
    ) -> None:
        now = completed_at or datetime.now(UTC)
        self._last_backup_at = now
        self._next_backup_at = now + timedelta(seconds=self.interval_seconds)

    def _signal_schedule_recalculation(self) -> None:
        if self._wake_event is not None:
            self._wake_event.set()

    def reset_schedule_from_now(self) -> None:
        now = datetime.now(UTC)
        self._last_backup_at = now
        self._next_backup_at = now + timedelta(seconds=self.interval_seconds)
        self._signal_schedule_recalculation()

    def get_schedule_status(self) -> dict[str, Any]:
        now = datetime.now(UTC)
        next_at = self._next_backup_at
        last_at = self._last_backup_at

        if (
            next_at
            and settings.BACKUP_AUTO_START
            and self._task
            and not self._task.done()
        ):
            seconds_until_next = max(0, int((next_at - now).total_seconds()))
        else:
            seconds_until_next = None

        return {
            "enabled": bool(
                settings.BACKUP_AUTO_START and self._task and not self._task.done()
            ),
            "interval_minutes": settings.BACKUP_INTERVAL_MINUTES,
            "last_backup_at": last_at.isoformat() if last_at else None,
            "next_backup_at": next_at.isoformat() if next_at else None,
            "seconds_until_next_backup": seconds_until_next,
        }

    def _ensure_bucket(self) -> None:
        minio_client.ensure_bucket(self.bucket_name)

    def _stats_from_db(self, db: Session) -> dict[str, int]:
        return {
            "users": db.query(User).count(),
            "projects": db.query(Project).count(),
            "notes": db.query(Note).count(),
            "files": db.query(FileNode).count(),
            "monuments": db.query(Monument).count(),
            "forms": db.query(FisaInstance).count(),
        }

    def get_live_stats(self, db: Session) -> dict[str, int]:
        return self._stats_from_db(db)

    def _upload_bytes(self, key: str, payload: bytes, content_type: str) -> None:
        if not minio_client.client:
            raise RuntimeError("MinIO client unavailable")

        minio_client.client.put_object(
            self.bucket_name,
            key,
            data=BytesIO(payload),
            length=len(payload),
            content_type=content_type,
        )

    def _target_databases(self) -> list[str]:
        raw = settings.BACKUP_DATABASES.strip()
        if raw:
            seen: set[str] = set()
            out: list[str] = []
            for value in raw.split(","):
                db_name = value.strip()
                if not db_name or db_name in seen:
                    continue
                seen.add(db_name)
                out.append(db_name)

            if out:
                return out

        discovered = self._discover_databases()
        if discovered:
            return discovered

        return [settings.POSTGRES_DB]

    def _discover_databases(self) -> list[str]:
        if not self._psql_bin:
            self._psql_bin = self._resolve_binary(
                preferred=settings.BACKUP_PSQL_BIN,
                default_name="psql",
            )
        psql_bin = self._require_binary(self._psql_bin, "psql", "BACKUP_PSQL_BIN")

        env = os.environ.copy()
        env["PGPASSWORD"] = settings.POSTGRES_PASSWORD
        command = [
            psql_bin,
            "--host",
            settings.POSTGRES_HOST,
            "--port",
            str(settings.POSTGRES_PORT),
            "--username",
            settings.POSTGRES_USER,
            "--dbname",
            "postgres",
            "-At",
            "-c",
            "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname;",
        ]

        try:
            result = subprocess.run(
                command, env=env, check=True, capture_output=True, text=True
            )
        except Exception as exc:
            logger.warning(
                "Database discovery failed; falling back to POSTGRES_DB",
                error=str(exc),
            )
            return []

        databases = [
            line.strip() for line in result.stdout.splitlines() if line.strip()
        ]
        if not databases:
            return []

        return databases

    def _backup_minio_objects(self, backup_id: str) -> tuple[list[str], int]:
        if not minio_client.client:
            return ([], 0)

        bucket_names = [
            bucket.name
            for bucket in minio_client.client.list_buckets()
            if bucket.name != self.bucket_name
        ]
        bucket_names.sort()

        copied_object_count = 0
        for bucket_name in bucket_names:
            objects = minio_client.client.list_objects(bucket_name, recursive=True)
            for obj in objects:
                source = CopySource(bucket_name, obj.object_name)
                destination_key = (
                    f"{backup_id}/minio/{bucket_name}/{obj.object_name}"
                )
                minio_client.client.copy_object(
                    self.bucket_name,
                    destination_key,
                    source,
                )
                copied_object_count += 1

        return (bucket_names, copied_object_count)

    def _restore_minio_snapshot(self, record: BackupRecord) -> None:
        if not minio_client.client:
            return

        for bucket_name in record.storage_bucket_names:
            minio_client.ensure_bucket(bucket_name)

            existing_objects = minio_client.client.list_objects(
                bucket_name, recursive=True
            )
            for existing in existing_objects:
                minio_client.client.remove_object(bucket_name, existing.object_name)

            snapshot_prefix = f"{record.backup_id}/minio/{bucket_name}/"
            snapshot_objects = minio_client.client.list_objects(
                self.bucket_name,
                prefix=snapshot_prefix,
                recursive=True,
            )
            for snapshot in snapshot_objects:
                object_name = snapshot.object_name[len(snapshot_prefix) :]
                source = CopySource(self.bucket_name, snapshot.object_name)
                minio_client.client.copy_object(bucket_name, object_name, source)

    def _run_pg_dump(self, output_path: str, db_name: str) -> None:
        if not self._pg_dump_bin:
            self._pg_dump_bin = self._resolve_binary(
                preferred=settings.BACKUP_PGDUMP_BIN,
                default_name="pg_dump",
            )
        pg_dump_bin = self._require_binary(
            self._pg_dump_bin, "pg_dump", "BACKUP_PGDUMP_BIN"
        )
        env = os.environ.copy()
        env["PGPASSWORD"] = settings.POSTGRES_PASSWORD
        command = [
            pg_dump_bin,
            "--host",
            settings.POSTGRES_HOST,
            "--port",
            str(settings.POSTGRES_PORT),
            "--username",
            settings.POSTGRES_USER,
            "--dbname",
            db_name,
            "--clean",
            "--if-exists",
            "--no-owner",
            "--no-privileges",
            "--file",
            output_path,
        ]
        subprocess.run(command, env=env, check=True, capture_output=True, text=True)

    def _run_psql_restore(self, input_path: str, db_name: str) -> None:
        if not self._psql_bin:
            self._psql_bin = self._resolve_binary(
                preferred=settings.BACKUP_PSQL_BIN,
                default_name="psql",
            )
        psql_bin = self._require_binary(self._psql_bin, "psql", "BACKUP_PSQL_BIN")
        env = os.environ.copy()
        env["PGPASSWORD"] = settings.POSTGRES_PASSWORD
        command = [
            psql_bin,
            "--host",
            settings.POSTGRES_HOST,
            "--port",
            str(settings.POSTGRES_PORT),
            "--username",
            settings.POSTGRES_USER,
            "--dbname",
            db_name,
            "--set",
            "ON_ERROR_STOP=1",
            "--file",
            input_path,
        ]
        subprocess.run(command, env=env, check=True, capture_output=True, text=True)

    def list_backups(self) -> list[BackupRecord]:
        self._ensure_bucket()
        if not minio_client.client:
            return []

        records: list[BackupRecord] = []
        try:
            objects = minio_client.client.list_objects(
                self.bucket_name,
                recursive=True,
            )
            metadata_keys = [
                obj.object_name
                for obj in objects
                if obj.object_name.endswith("/metadata.json")
            ]
            for metadata_key in metadata_keys:
                data = minio_client.client.get_object(self.bucket_name, metadata_key)
                raw = data.read()
                data.close()
                data.release_conn()
                parsed: dict[str, Any] = json.loads(raw.decode("utf-8"))
                parsed_dump_keys = parsed.get("dump_keys")
                if isinstance(parsed_dump_keys, list):
                    dump_keys = [str(item) for item in parsed_dump_keys if item]
                else:
                    single_dump_key = parsed.get("dump_key") or metadata_key.replace(
                        "metadata.json", "dump.sql"
                    )
                    dump_keys = [single_dump_key]

                parsed_db_names = parsed.get("database_names")
                if isinstance(parsed_db_names, list) and len(parsed_db_names) == len(
                    dump_keys
                ):
                    database_names = [str(item) for item in parsed_db_names]
                else:
                    database_names = []
                    for dump_key in dump_keys:
                        filename = os.path.basename(dump_key)
                        if filename.endswith(".sql"):
                            database_names.append(filename[:-4])
                        else:
                            database_names.append(settings.POSTGRES_DB)

                parsed_storage = (
                    parsed.get("storage")
                    if isinstance(parsed.get("storage"), dict)
                    else {}
                )
                parsed_storage_buckets = (
                    parsed_storage.get("bucket_names")
                    if isinstance(parsed_storage, dict)
                    else []
                )
                if isinstance(parsed_storage_buckets, list):
                    storage_bucket_names = [
                        str(item) for item in parsed_storage_buckets if item
                    ]
                else:
                    storage_bucket_names = []

                storage_object_count = (
                    int(parsed_storage.get("object_count", 0))
                    if isinstance(parsed_storage, dict)
                    else 0
                )

                total_size = 0
                for dump_key in dump_keys:
                    try:
                        stat = minio_client.client.stat_object(
                            self.bucket_name, dump_key
                        )
                        total_size += int(stat.size)
                    except Exception:
                        continue

                records.append(
                    BackupRecord(
                        backup_id=parsed["backup_id"],
                        created_at=parsed["created_at"],
                        trigger=parsed.get("trigger", "unknown"),
                        dump_keys=dump_keys,
                        database_names=database_names,
                        storage_bucket_names=storage_bucket_names,
                        storage_object_count=storage_object_count,
                        metadata_key=metadata_key,
                        sql_size_bytes=total_size,
                        stats={
                            k: int(v) for k, v in (parsed.get("stats") or {}).items()
                        },
                    )
                )
        except S3Error as exc:
            logger.exception("Failed listing backups", error=str(exc))
            return []

        records.sort(key=lambda item: item.created_at, reverse=True)
        return records

    def _cleanup_old_backups(self) -> None:
        records = self.list_backups()
        retention_count = max(1, settings.BACKUP_RETENTION_COUNT)
        if len(records) <= retention_count:
            return

        if not minio_client.client:
            return

        to_delete = records[retention_count:]
        for record in to_delete:
            for dump_key in record.dump_keys:
                try:
                    minio_client.client.remove_object(self.bucket_name, dump_key)
                except Exception:
                    logger.warning(
                        "Failed deleting backup dump object", key=dump_key
                    )
            try:
                minio_client.client.remove_object(
                    self.bucket_name, record.metadata_key
                )
            except Exception:
                logger.warning(
                    "Failed deleting backup metadata object", key=record.metadata_key
                )

    def create_backup(self, trigger: str = "manual") -> BackupRecord:
        self._ensure_bucket()

        db = SessionLocal()
        try:
            stats = self._stats_from_db(db)
        finally:
            db.close()

        now = datetime.now(UTC)
        timestamp = now.strftime("%Y%m%dT%H%M%S.%fZ")
        backup_id = f"backup-{timestamp}"
        database_names = self._target_databases()
        dump_keys = [f"{backup_id}/db/{db_name}.sql" for db_name in database_names]
        metadata_key = f"{backup_id}/metadata.json"

        temp_dump_paths: list[str] = []
        for db_name in database_names:
            with tempfile.NamedTemporaryFile(
                suffix=f"-{db_name}.sql", delete=False
            ) as tmp:
                temp_dump_paths.append(tmp.name)

        try:
            dump_payloads: list[bytes] = []
            for db_name, temp_dump_path in zip(
                database_names, temp_dump_paths, strict=True
            ):
                self._run_pg_dump(temp_dump_path, db_name)
                with open(temp_dump_path, "rb") as f:
                    dump_payloads.append(f.read())

            total_size = 0
            for dump_key, dump_payload in zip(dump_keys, dump_payloads, strict=True):
                total_size += len(dump_payload)
                self._upload_bytes(dump_key, dump_payload, "application/sql")

            storage_bucket_names, storage_object_count = self._backup_minio_objects(
                backup_id
            )

            metadata = {
                "backup_id": backup_id,
                "created_at": now.isoformat(),
                "trigger": trigger,
                "database_names": database_names,
                "dump_keys": dump_keys,
                "stats": stats,
                "storage": {
                    "bucket_names": storage_bucket_names,
                    "object_count": storage_object_count,
                },
            }
            metadata_payload = json.dumps(metadata, indent=2).encode("utf-8")

            self._upload_bytes(metadata_key, metadata_payload, "application/json")

            record = BackupRecord(
                backup_id=backup_id,
                created_at=metadata["created_at"],
                trigger=trigger,
                dump_keys=dump_keys,
                database_names=database_names,
                storage_bucket_names=storage_bucket_names,
                storage_object_count=storage_object_count,
                metadata_key=metadata_key,
                sql_size_bytes=total_size,
                stats=stats,
            )
            self._cleanup_old_backups()
            return record
        finally:
            for temp_dump_path in temp_dump_paths:
                try:
                    os.remove(temp_dump_path)
                except FileNotFoundError:
                    pass

    def get_backup(self, backup_id: str) -> BackupRecord | None:
        for record in self.list_backups():
            if record.backup_id == backup_id:
                return record
        return None

    def restore_backup(self, backup_id: str) -> BackupRecord:
        record = self.get_backup(backup_id)
        if not record:
            raise ValueError("Backup not found")
        if not minio_client.client:
            raise RuntimeError("MinIO client unavailable")

        temp_paths: list[str] = []
        try:
            for db_name, dump_key in zip(
                record.database_names, record.dump_keys, strict=True
            ):
                obj = minio_client.client.get_object(self.bucket_name, dump_key)
                dump_payload = obj.read()
                obj.close()
                obj.release_conn()

                with tempfile.NamedTemporaryFile(
                    suffix=f"-{db_name}.sql", delete=False
                ) as tmp:
                    temp_dump_path = tmp.name
                    tmp.write(dump_payload)
                    temp_paths.append(temp_dump_path)

                self._run_psql_restore(temp_dump_path, db_name)

            self._restore_minio_snapshot(record)
        finally:
            for temp_dump_path in temp_paths:
                try:
                    os.remove(temp_dump_path)
                except FileNotFoundError:
                    pass

        return record

    def diff_with_live(self, backup_id: str, db: Session) -> dict[str, Any]:
        record = self.get_backup(backup_id)
        if not record:
            raise ValueError("Backup not found")

        live_stats = self.get_live_stats(db)
        backup_stats = record.stats
        keys = sorted(set(live_stats.keys()) | set(backup_stats.keys()))
        differences = {
            key: {
                "backup": int(backup_stats.get(key, 0)),
                "live": int(live_stats.get(key, 0)),
                "delta_live_minus_backup": int(live_stats.get(key, 0))
                - int(backup_stats.get(key, 0)),
            }
            for key in keys
        }

        return {
            "backup_id": record.backup_id,
            "backup_created_at": record.created_at,
            "backup_stats": backup_stats,
            "live_stats": live_stats,
            "differences": differences,
        }

    async def _scheduled_loop(self) -> None:
        logger.info(
            "Backup scheduler started",
            interval_minutes=settings.BACKUP_INTERVAL_MINUTES,
            retention=settings.BACKUP_RETENTION_COUNT,
        )

        if self._next_backup_at is None:
            self._next_backup_at = datetime.now(UTC) + timedelta(
                seconds=self.interval_seconds
            )

        while True:
            now = datetime.now(UTC)
            next_at = self._next_backup_at or now
            wait_seconds = max(0.0, (next_at - now).total_seconds())

            if wait_seconds > 0 and self._wake_event is not None:
                try:
                    await asyncio.wait_for(
                        self._wake_event.wait(), timeout=wait_seconds
                    )
                    self._wake_event.clear()
                    continue
                except TimeoutError:
                    pass

            try:
                await asyncio.to_thread(self.create_backup, "scheduled-hourly")
                self._touch_after_successful_backup()
                logger.info("Scheduled backup finished")
            except Exception as exc:
                logger.exception("Scheduled backup failed", error=str(exc))
                self._next_backup_at = datetime.now(UTC) + timedelta(
                    seconds=self.interval_seconds
                )

    async def start_scheduler(self) -> None:
        if not settings.BACKUP_AUTO_START:
            logger.info("Backup scheduler disabled")
            return
        if not self._pg_dump_bin:
            logger.warning(
                "Backup scheduler disabled because pg_dump was not found",
                configured=settings.BACKUP_PGDUMP_BIN,
            )
            return
        if self._task and not self._task.done():
            return

        # Recover last successful backup timestamp from existing metadata for status display.
        try:
            records = self.list_backups()
            if records:
                self._last_backup_at = datetime.fromisoformat(records[0].created_at)
        except Exception:
            pass

        self._wake_event = asyncio.Event()
        # First backup is scheduled one full interval after startup.
        self._next_backup_at = datetime.now(UTC) + timedelta(
            seconds=self.interval_seconds
        )
        self._task = asyncio.create_task(self._scheduled_loop())

    async def stop_scheduler(self) -> None:
        if not self._task:
            return
        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            pass
        self._task = None
        self._wake_event = None
        self._next_backup_at = None


backup_service = BackupService()
