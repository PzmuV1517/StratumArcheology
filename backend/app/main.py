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

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.requests import Request

from app.backup_service import backup_service
from app.config import settings
from app.firebase_config import initialize_firebase
from app.middleware import ErrorHandlingMiddleware, configure_logging, get_logger
from app.minio_client import minio_client, set_request_base_url
from app.rate_limiter import limiter
from app.routes import (
    activities,
    auth,
    channels,
    chat,
    convert,
    emonument_dashboard,
    emonument_backups,
    emonument_instances,
    files,
    forms,
    gps,
    invites,
    notes,
    projects,
    qrcodes,
)
from app.websocket import sio_app

# Configure structured logging based on environment
configure_logging(debug=settings.APP_DEBUG)
logger = get_logger(__name__)

# Initialize Firebase
initialize_firebase()
logger.info("Firebase initialized")

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
)


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


@app.get("/health")
@app.get("/api/health")
async def health_check():
    """Health check endpoint (available at both /health and /api/health)"""
    return {"status": "healthy", "database": "connected", "storage": "connected"}


@app.on_event("startup")
async def _start_backup_scheduler():
    await backup_service.start_scheduler()


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
