"""
STRATUM Backend Middleware Package

Contains middleware components for:
- Error handling and exception capture
- Structured logging with context
- Request/response logging
- Database transaction management


STRATUM - Proprietary and Confidential
Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
All rights reserved.
No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
"""

from .error_handler import ErrorHandlingMiddleware
from .logging_config import LogContext, configure_logging, get_logger

__all__ = [
    "ErrorHandlingMiddleware",
    "configure_logging",
    "get_logger",
    "LogContext",
]
