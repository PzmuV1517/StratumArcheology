"""
STRATUM API - Archaeological Site Management Platform

Main FastAPI application entry point with:
- Error handling middleware
- Structured logging
- CORS configuration
- Route registration

IMPORTANT: Database migrations are handled by Alembic, NOT create_all().
Run migrations with: alembic upgrade head

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

import os
import resource
import sys
import time
from datetime import UTC, datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.requests import Request

from app.backup_service import backup_service
from app.config import settings
from app.database import is_database_available
from app.firebase_config import get_firebase_status, initialize_firebase
from app.middleware import ErrorHandlingMiddleware, configure_logging, get_logger
from app.minio_client import minio_client, set_request_base_url
from app.rate_limiter import limiter
from app.routes import (
    activities,
    ai,
    auth,
    channels,
    chat,
    convert,
    emonument_backups,
    emonument_dashboard,
    emonument_instances,
    files,
    forms,
    gps,
    invites,
    notes,
    projects,
    qrcodes,
)
from app.transcription import load_whisper_model
from app.websocket import sio_app

# Configure structured logging based on environment
configure_logging(debug=settings.APP_DEBUG)
logger = get_logger(__name__)

_process_started_monotonic = time.monotonic()
_process_started_at = datetime.now(UTC)

# Initialize Firebase based on auth mode.
firebase_ready = initialize_firebase(
    strict=settings.auth_mode_normalized == "firebase"
)
if firebase_ready:
    logger.info("Firebase initialized")
elif settings.firebase_auth_enabled:
    logger.warning("Firebase unavailable - Google/Firebase auth will be disabled")
else:
    logger.info("Firebase auth disabled by configuration", auth_mode=settings.AUTH_MODE)

# =============================================================================
# DATABASE MIGRATIONS
# =============================================================================
# IMPORTANT: Do NOT call Base.metadata.create_all() here.
# Database schema is managed by Alembic migrations.
# Run migrations with: alembic upgrade head
# =============================================================================

# Create FastAPI app
app = FastAPI(
    title="STRATUM API",
    description="Archaeological site management and collaboration platform",
    version="1.0.0",
)
app.state.started_at_iso = _process_started_at.isoformat()
app.state.started_monotonic = _process_started_monotonic
app.state.firebase_ready = firebase_ready

# Attach the rate limiter to the app
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Add error handling middleware (must be first to catch all errors)
app.add_middleware(ErrorHandlingMiddleware, minio_client=minio_client)

# Add rate limiting middleware
app.add_middleware(SlowAPIMiddleware)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Capture the request base URL so MinIO helpers can build proxy URLs
# that are reachable from any device (instead of localhost presigned URLs).
@app.middleware("http")
async def _capture_base_url(request: Request, call_next):
    set_request_base_url(str(request.base_url))
    response = await call_next(request)
    if request.url.path.startswith("/api"):
        response.headers.setdefault("X-Robots-Tag", "noindex, nofollow")
    return response

# Include routers
app.include_router(auth.router, prefix="/api")
app.include_router(ai.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(notes.router, prefix="/api")
app.include_router(files.router, prefix="/api")
app.include_router(convert.router, prefix="/api")
app.include_router(gps.router, prefix="/api")
app.include_router(forms.router, prefix="/api")
app.include_router(invites.router, prefix="/api")
app.include_router(qrcodes.router, prefix="/api")
app.include_router(activities.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(channels.router, prefix="/api")
app.include_router(emonument_dashboard.router, prefix="/api")
app.include_router(emonument_backups.router, prefix="/api")
app.include_router(emonument_instances.router, prefix="/api")

logger.info(
    "STRATUM API started",
    environment=settings.ENVIRONMENT,
    debug=settings.APP_DEBUG,
    host=settings.APP_HOST,
    port=settings.APP_PORT,
    auth_mode=settings.auth_mode_normalized,
    deployment_mode=settings.deployment_mode_normalized,
)


def _get_uptime_seconds() -> float:
    started = getattr(app.state, "started_monotonic", _process_started_monotonic)
    return max(0.0, time.monotonic() - float(started))


def _get_memory_rss_mb() -> float | None:
    try:
        rss_kb = float(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)
        if sys.platform == "darwin":
            return round(rss_kb / (1024 * 1024), 2)
        return round(rss_kb / 1024, 2)
    except Exception:
        return None


def _get_load_average() -> dict[str, float] | None:
    try:
        load_1m, load_5m, load_15m = os.getloadavg()
        return {
            "1m": round(load_1m, 2),
            "5m": round(load_5m, 2),
            "15m": round(load_15m, 2),
        }
    except Exception:
        return None


def _service_checks() -> dict[str, bool]:
    firebase_status = get_firebase_status()
    firebase_ok = (
        bool(firebase_status.get("ready"))
        if settings.firebase_auth_enabled
        else True
    )

    return {
        "database": is_database_available(),
        "storage": minio_client.is_available(),
        "firebase": firebase_ok,
    }


@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "STRATUM API", "version": "1.0.0", "status": "operational"}


@app.get("/api", include_in_schema=False)
@app.get("/api/", include_in_schema=False)
async def api_root():
    """API root endpoint for health and crawler-safe discovery."""
    return JSONResponse(
        {
            "message": "STRATUM API root",
            "version": "1.0.0",
            "status": "operational",
            "health": "/api/health",
        }
    )


@app.get("/api/capabilities")
async def capabilities():
    """Public capability descriptor used by clients on startup."""
    firebase_status = get_firebase_status()
    firebase_ready = bool(firebase_status.get("ready"))

    warnings: list[str] = []
    if settings.deployment_mode_normalized == "self_hosted":
        warnings.append("Running in self-hosted mode")
    if settings.firebase_auth_enabled and not firebase_ready:
        warnings.append("Firebase is configured but currently unavailable")

    return {
        "status": "operational",
        "server_time": datetime.now(UTC).isoformat(),
        "deployment": {
            "mode": settings.deployment_mode_normalized,
            "self_hosted_bundle": settings.SELF_HOST_BUNDLE,
        },
        "auth": {
            "auth_mode": settings.auth_mode_normalized,
            "firebase_enabled": settings.firebase_auth_enabled,
            "firebase_ready": firebase_ready,
            "google_auth_available": settings.google_auth_enabled and firebase_ready,
            "local_auth_available": settings.local_auth_enabled,
        },
        "features": {
            "backup_scheduler": bool(
                backup_service.get_schedule_status().get("enabled")
            ),
            "websocket": True,
        },
        "warnings": warnings,
    }


@app.get("/api/system/status")
async def system_status(request: Request):
    """Public runtime status payload for self-host launcher diagnostics."""
    checks = _service_checks()
    healthy = all(checks.values())
    backup_schedule = backup_service.get_schedule_status()

    base_url = str(request.base_url).rstrip("/")
    return {
        "status": "operational" if healthy else "degraded",
        "started_at": getattr(app.state, "started_at_iso", _process_started_at.isoformat()),
        "uptime_seconds": round(_get_uptime_seconds(), 2),
        "resources": {
            "memory_rss_mb": _get_memory_rss_mb(),
            "load_average": _get_load_average(),
        },
        "services": {
            "database": "connected" if checks["database"] else "unavailable",
            "storage": "connected" if checks["storage"] else "unavailable",
            "firebase": "connected" if checks["firebase"] else "unavailable",
            "backup": backup_schedule,
        },
        "urls": {
            "api": f"{base_url}/api",
            "health": f"{base_url}/api/health",
            "capabilities": f"{base_url}/api/capabilities",
            "status": f"{base_url}/api/system/status",
        },
    }


@app.get("/health")
@app.get("/api/health")
async def health_check():
    """Health check endpoint (available at both /health and /api/health)."""
    checks = _service_checks()
    healthy = all(checks.values())

    return {
        "status": "healthy" if healthy else "degraded",
        "database": "connected" if checks["database"] else "unavailable",
        "storage": "connected" if checks["storage"] else "unavailable",
        "firebase": "connected" if checks["firebase"] else "unavailable",
        "auth_mode": settings.auth_mode_normalized,
        "deployment_mode": settings.deployment_mode_normalized,
        "uptime_seconds": round(_get_uptime_seconds(), 2),
    }


@app.on_event("startup")
async def _start_backup_scheduler():
    await backup_service.start_scheduler()


@app.on_event("startup")
async def _load_whisper():
    if settings.DISABLE_WHISPER:
        logger.info("Whisper disabled via DISABLE_WHISPER=true — skipping model load")
        return
    try:
        loop = __import__("asyncio").get_event_loop()
        await loop.run_in_executor(None, load_whisper_model)
    except Exception as exc:
        logger.warning("Whisper startup skipped", reason=str(exc))


@app.on_event("shutdown")
async def _stop_backup_scheduler():
    await backup_service.stop_scheduler()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.APP_HOST,
        port=settings.APP_PORT,
        reload=settings.APP_DEBUG,
    )


# Mount Socket.IO app
# This must be done after all routes are registered
app.mount("/ws", sio_app)
