"""
STRATUM Backend Middleware Package

Contains middleware components for:
- Error handling and exception capture
- Structured logging with context
- Request/response logging
- Database transaction management
"""

from .error_handler import ErrorHandlingMiddleware
from .logging_config import LogContext, configure_logging, get_logger

__all__ = [
    "ErrorHandlingMiddleware",
    "configure_logging",
    "get_logger",
    "LogContext",
]
