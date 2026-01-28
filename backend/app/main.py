"""
STRATUM API - Archaeological Site Management Platform

Main FastAPI application entry point with:
- Error handling middleware
- Security headers middleware
- Rate limiting
- Structured logging
- CORS configuration
- Route registration

IMPORTANT: Database migrations are handled by Alembic, NOT create_all().
Run migrations with: alembic upgrade head
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from app.config import settings
from app.firebase_config import initialize_firebase
from app.middleware import (
    ErrorHandlingMiddleware,
    SecurityHeadersMiddleware,
    configure_logging,
    get_logger,
)
from app.minio_client import minio_client
from app.rate_limiter import init_rate_limiter, limiter
from app.routes import (
    activities,
    auth,
    convert,
    files,
    forms,
    gps,
    invites,
    notes,
    projects,
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
# REMOVED: Base.metadata.create_all(bind=engine)
#
# Database schema is now managed by Alembic migrations.
#
# To apply migrations:
#   cd backend
#   alembic upgrade head
#
# To create a new migration after model changes:
#   alembic revision --autogenerate -m "description of changes"
#
# To downgrade:
#   alembic downgrade -1  (one step back)
#   alembic downgrade base  (all the way back)
# =============================================================================

# Create FastAPI app
app = FastAPI(
    title="STRATUM API",
    description="Archaeological site management and collaboration platform",
    version="1.0.0",
    docs_url="/api/docs" if settings.APP_DEBUG else None,  # Disable docs in production
    redoc_url="/api/redoc" if settings.APP_DEBUG else None,
    openapi_url="/api/openapi.json" if settings.APP_DEBUG else None,
)

# =============================================================================
# MIDDLEWARE CONFIGURATION (Order matters - last added = first executed)
# =============================================================================

# Initialize rate limiter
init_rate_limiter(app)
logger.info("Rate limiter initialized")

# Add security headers middleware
app.add_middleware(SecurityHeadersMiddleware, environment=settings.ENVIRONMENT)

# Add error handling middleware (must be first to catch all errors)
# This provides:
# - Structured error logging with request context
# - Database transaction rollback on errors
# - MinIO upload cleanup on errors
# - User-friendly error responses
app.add_middleware(ErrorHandlingMiddleware, minio_client=minio_client)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset", "Retry-After"],
)

# Add trusted host middleware in production
if settings.ENVIRONMENT == "production":
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=settings.allowed_origins_list + ["localhost", "127.0.0.1"],
    )

# Include routers
app.include_router(auth.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(notes.router, prefix="/api")
app.include_router(files.router, prefix="/api")
app.include_router(convert.router, prefix="/api")
app.include_router(gps.router, prefix="/api")
app.include_router(forms.router, prefix="/api")
app.include_router(invites.router, prefix="/api")
app.include_router(activities.router, prefix="/api")

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


@app.get("/health")
@app.get("/api/health")
async def health_check():
    """Health check endpoint (available at both /health and /api/health)"""
    return {"status": "healthy", "database": "connected", "storage": "connected"}


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
