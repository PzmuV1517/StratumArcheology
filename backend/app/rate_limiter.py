"""
Rate Limiter Module

This module provides functionality to limit the rate of requests
to endpoints in the application using slowapi (FastAPI-compatible).

Features:
- Global default rate limiting
- Dynamic per-endpoint rate limits
- Custom error response for rate limit exceeded
- IP-based and user-based rate limiting
"""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.config import settings


def get_rate_limit_key(request: Request) -> str:
    """
    Get rate limit key based on user ID (if authenticated) or IP address.
    This provides per-user rate limiting for authenticated requests.
    """
    # Try to get user from request state (set by auth middleware)
    user = getattr(request.state, "user", None)
    if user and hasattr(user, "id"):
        return f"user:{user.id}"
    # Fall back to IP address for unauthenticated requests
    return get_remote_address(request)


# Initialize the rate limiter with default settings
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[settings.RATE_LIMIT_DEFAULT],
    headers_enabled=True,  # Add rate limit headers to responses
)


# =============================================================================
# RATE LIMIT CONFIGURATIONS
# =============================================================================
# Rate limits are configured in config.py (Settings class)
# Access them via settings.RATE_LIMIT_* (e.g., settings.RATE_LIMIT_AUTH_LOGIN)
#
# Available limits:
#   - RATE_LIMIT_AUTH_LOGIN: Login attempts (strict)
#   - RATE_LIMIT_AUTH_REGISTER: Registration attempts (strict)
#   - RATE_LIMIT_PASSWORD_RESET: Password reset requests (strict)
#   - RATE_LIMIT_CREATE_PROJECT: Project creation (moderate)
#   - RATE_LIMIT_CREATE_NOTE: Note creation (moderate)
#   - RATE_LIMIT_FILE_UPLOAD: File uploads (moderate)
#   - RATE_LIMIT_INVITE_CREATE: Invitation creation (moderate)
#   - RATE_LIMIT_READ_OPERATIONS: General reads (relaxed)
#   - RATE_LIMIT_LIST_OPERATIONS: List endpoints (relaxed)
#   - RATE_LIMIT_SEARCH: Search operations (relaxed)
#   - RATE_LIMIT_HEALTH_CHECK: Health checks (very relaxed)
#   - RATE_LIMIT_WEBSOCKET: WebSocket connections (special)
#   - RATE_LIMIT_FILE_DOWNLOAD: File downloads (special)
#   - RATE_LIMIT_CONVERT: File conversion (strict, resource intensive)


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """
    Custom handler for rate limit exceeded errors.
    Returns a user-friendly error message for the frontend.
    """
    return JSONResponse(
        status_code=429,
        content={
            "error": "rate_limit_exceeded",
            "message": "You are sending too many requests to the server! Please wait.",
            "detail": "If you believe this is a mistake, contact us at quantumrobotics.bits@ichb.ro",
            "retry_after": exc.detail.split("per")[0].strip() if exc.detail else "1 minute",
        },
        headers={
            "Retry-After": "60",  # Suggest retry after 60 seconds
            "X-RateLimit-Limit": str(exc.detail) if exc.detail else "unknown",
        },
    )


def init_rate_limiter(app: FastAPI) -> None:
    """
    Initialize the rate limiter with the FastAPI application.

    Args:
        app: The FastAPI application instance.
    """
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
