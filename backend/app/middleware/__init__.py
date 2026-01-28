"""
STRATUM Backend Middleware Package

Contains middleware components for:
- Error handling and exception capture
- Structured logging with context
- Request/response logging
- Database transaction management
- Security headers
"""

from .error_handler import ErrorHandlingMiddleware
from .logging_config import LogContext, configure_logging, get_logger
from .security_headers import SecurityHeadersMiddleware

__all__ = [
    "ErrorHandlingMiddleware",
    "SecurityHeadersMiddleware",
    "configure_logging",
    "get_logger",
    "LogContext",
]
