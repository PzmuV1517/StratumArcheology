"""
Rate Limiter Module (SlowAPI)

Dynamic per-endpoint rate limiting for STRATUM API.
Each endpoint tier has different limits to match expected usage patterns.

Tiers:
  - AUTH:      Strict limits on login/register to prevent brute-force (5/min)
  - WRITE:     Moderate limits on create/update/delete operations (30/min)
  - READ:      Generous limits on data fetching (60/min)
  - UPLOAD:    Tight limits on file uploads (10/min)
  - CONVERT:   Tight limits on CPU-intensive conversion (5/min)
  - HEALTH:    Very generous for monitoring probes (120/min)

When a user exceeds their limit, the response includes:
  - HTTP 429 status
  - JSON body with a user-friendly message for the frontend modal
  - Retry-After header
"""

from tracepatch import trace # for better debugging. NOTE: While tracepatch does not have overhead if disabled, it's safe to comment this out in prod build.

from fastapi import Request
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.responses import JSONResponse

from app.middleware import get_logger

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Key function: identifies the caller
# ---------------------------------------------------------------------------
@trace()
def _get_client_key(request: Request) -> str:
    """
    Extracts a rate-limit key from the request.

    Priority:
      1. Authenticated user id from request state (set by auth dependency)
      2. X-Forwarded-For header (behind reverse proxy)
      3. Client IP address
    """
    # If the auth dependency already ran, prefer the user id so
    # authenticated users each get their own bucket.
    user = getattr(request.state, "current_user", None)
    if user and hasattr(user, "id"):
        return f"user:{user.id}"

    # Fall back to IP-based limiting
    return get_remote_address(request)


# ---------------------------------------------------------------------------
# Limiter singleton
# ---------------------------------------------------------------------------
limiter = Limiter(
    key_func=_get_client_key,
    default_limits=["100/minute"],
    storage_uri="memory://",          # swap to redis:// in production
    strategy="fixed-window",
)


# ---------------------------------------------------------------------------
# Pre-built decorators for each tier
# ---------------------------------------------------------------------------
# Usage in routes:  @limit_auth   (applied BEFORE the route decorator)
#
# Example:
#   @router.post("/login")
#   @limit_auth
#   async def login(...): ...

limit_auth    = limiter.limit("5/minute")
limit_write   = limiter.limit("30/minute")
limit_read    = limiter.limit("60/minute")
limit_upload  = limiter.limit("10/minute")
limit_convert = limiter.limit("5/minute")
limit_health  = limiter.limit("120/minute")


# ---------------------------------------------------------------------------
# Custom 429 handler – returns JSON the frontend can display in a modal
# ---------------------------------------------------------------------------
@trace()
def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """
    Called automatically by SlowAPI when a rate limit is exceeded.

    Returns a JSON payload the frontend interprets to show a modal:
      {
        "error": "rate_limited",
        "message": "Slow down, there. You are being Rate Limited",
        "retry_after": <seconds>
      }
    """
    retry_after = exc.detail.split(" per ")[0] if " per " in exc.detail else "60"

    logger.warning(
        "Rate limit exceeded",
        client=_get_client_key(request),
        path=request.url.path,
        detail=exc.detail,
    )

    return JSONResponse(
        status_code=429,
        content={
            "error": "rate_limited",
            "message": "Slow down, there. You are being Rate Limited",
            "detail": str(exc.detail),
            "retry_after": retry_after,
        },
        headers={
            "Retry-After": retry_after,
        },
    )
