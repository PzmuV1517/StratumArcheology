"""
Structured Logging Configuration for STRATUM

Provides structured logging with contextual information:
- user_id: The authenticated user performing the action
- project_id: The project being accessed
- action: The type of action being performed
- request_id: Unique identifier for tracking requests

Uses structlog for JSON-formatted, contextual logging that's easy to parse
and analyze in production monitoring systems.
"""
import logging
import sys
from contextvars import ContextVar
from typing import Optional, Dict, Any
from datetime import datetime
import uuid

import structlog

# Context variables for request-scoped logging context
# These allow us to attach user/project context to all log messages within a request
_log_context: ContextVar[Dict[str, Any]] = ContextVar('log_context', default={})
_request_id: ContextVar[Optional[str]] = ContextVar('request_id', default=None)


class LogContext:
    """
    Context manager for adding contextual information to log messages.
    
    Usage:
        async with LogContext(user_id="abc123", project_id="proj456"):
            logger.info("User accessed project")  # Will include user_id and project_id
    
    This ensures all log messages within the context include the relevant IDs,
    making it easy to trace actions and debug issues.
    """
    
    def __init__(
        self,
        user_id: Optional[str] = None,
        project_id: Optional[str] = None,
        action: Optional[str] = None,
        **extra: Any
    ):
        self.context_updates = {}
        if user_id:
            self.context_updates['user_id'] = user_id
        if project_id:
            self.context_updates['project_id'] = project_id
        if action:
            self.context_updates['action'] = action
        self.context_updates.update(extra)
        self._previous_context: Dict[str, Any] = {}
    
    def __enter__(self) -> 'LogContext':
        # Store the previous context for restoration
        self._previous_context = _log_context.get().copy()
        # Merge new context with existing
        new_context = {**self._previous_context, **self.context_updates}
        _log_context.set(new_context)
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        # Restore previous context
        _log_context.set(self._previous_context)
        return False  # Don't suppress exceptions
    
    async def __aenter__(self) -> 'LogContext':
        return self.__enter__()
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        return self.__exit__(exc_type, exc_val, exc_tb)


def add_log_context(
    logger: structlog.BoundLogger,
    method_name: str,
    event_dict: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Structlog processor that adds contextual information to log events.
    
    This automatically injects:
    - request_id: Unique ID for the current request
    - user_id, project_id, action: From LogContext if set
    - timestamp: ISO format timestamp
    """
    # Add request ID if available
    request_id = _request_id.get()
    if request_id:
        event_dict['request_id'] = request_id
    
    # Add context from LogContext
    context = _log_context.get()
    for key, value in context.items():
        if key not in event_dict:  # Don't override explicit values
            event_dict[key] = value
    
    # Add timestamp in ISO format
    event_dict['timestamp'] = datetime.utcnow().isoformat() + 'Z'
    
    return event_dict


def set_request_id(request_id: Optional[str] = None) -> str:
    """
    Set or generate a request ID for the current context.
    
    Args:
        request_id: Optional existing request ID (e.g., from X-Request-ID header)
    
    Returns:
        The request ID that was set
    """
    if request_id is None:
        request_id = str(uuid.uuid4())[:8]  # Short unique ID for log readability
    _request_id.set(request_id)
    return request_id


def clear_request_id():
    """Clear the request ID after request completion."""
    _request_id.set(None)


def configure_logging(debug: bool = False) -> None:
    """
    Configure structured logging for the application.
    
    In debug mode:
        - Pretty-printed, colored console output
        - DEBUG level logging
    
    In production mode:
        - JSON formatted output (for log aggregation)
        - INFO level logging
    
    Args:
        debug: Whether to use debug-friendly logging format
    """
    # Configure standard library logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=logging.DEBUG if debug else logging.INFO,
    )
    
    # Configure structlog processors
    shared_processors = [
        # Add log level
        structlog.stdlib.add_log_level,
        # Add logger name
        structlog.stdlib.add_logger_name,
        # Add our custom context
        add_log_context,
        # Handle exceptions
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        # Unwrap positional arguments (UnicodeDecoder replaced PositionalArgumentsFormatter)
        structlog.processors.UnicodeDecoder(),
    ]
    
    if debug:
        # Development: Pretty console output
        processors = shared_processors + [
            structlog.dev.ConsoleRenderer(colors=True)
        ]
    else:
        # Production: JSON output for log aggregation
        processors = shared_processors + [
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer()
        ]
    
    structlog.configure(
        processors=processors,
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str = __name__) -> structlog.BoundLogger:
    """
    Get a configured structlog logger.
    
    Args:
        name: Logger name (typically __name__ of the calling module)
    
    Returns:
        A structlog BoundLogger instance
    
    Usage:
        logger = get_logger(__name__)
        logger.info("Something happened", key="value")
    """
    return structlog.get_logger(name)
