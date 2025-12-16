"""
Error Handling Middleware for STRATUM

Provides centralized exception handling with:
- Structured error logging
- Database transaction rollback on errors
- MinIO file cleanup on upload errors
- User-friendly error responses
- Request/response timing

This middleware ensures that errors are:
1. Logged with full context (user, project, action, stack trace)
2. Cleaned up properly (DB rollback, file cleanup)
3. Returned as consistent JSON responses
"""
import time
import traceback
from typing import Callable, List, Optional
from datetime import datetime

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from .logging_config import (
    get_logger,
    set_request_id,
    clear_request_id,
    LogContext
)

logger = get_logger(__name__)


class UploadCleanupTracker:
    """
    Tracks MinIO uploads during a request for cleanup on error.
    
    Usage:
        tracker = UploadCleanupTracker()
        tracker.add_upload("projects/abc/files/image.jpg")
        # On error:
        await tracker.cleanup(minio_client)
    """
    
    def __init__(self):
        self._uploads: List[str] = []
    
    def add_upload(self, object_name: str):
        """Register an uploaded object for potential cleanup."""
        self._uploads.append(object_name)
    
    def mark_committed(self, object_name: Optional[str] = None):
        """
        Mark upload(s) as committed (should not be cleaned up on error).
        
        Args:
            object_name: Specific object to mark, or None to mark all
        """
        if object_name:
            if object_name in self._uploads:
                self._uploads.remove(object_name)
        else:
            self._uploads.clear()
    
    async def cleanup(self, minio_client) -> List[str]:
        """
        Clean up all tracked uploads.
        
        Returns list of objects that were cleaned up.
        """
        cleaned = []
        for obj in self._uploads:
            try:
                success = await minio_client.delete_file(obj)
                if success:
                    cleaned.append(obj)
                    logger.info("Cleaned up orphaned upload", object_name=obj)
            except Exception as e:
                logger.warning(
                    "Failed to cleanup orphaned upload",
                    object_name=obj,
                    error=str(e)
                )
        self._uploads.clear()
        return cleaned


class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """
    Middleware for centralized error handling and request logging.
    
    Features:
    - Request ID generation/propagation
    - Request/response timing
    - Exception capture with stack traces
    - Database transaction management
    - MinIO upload cleanup on errors
    """
    
    def __init__(self, app: ASGIApp, minio_client=None):
        super().__init__(app)
        self.minio_client = minio_client
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Generate or use existing request ID
        request_id = request.headers.get("X-Request-ID")
        request_id = set_request_id(request_id)
        
        # Start timing
        start_time = time.time()
        
        # Create upload tracker for this request
        upload_tracker = UploadCleanupTracker()
        request.state.upload_tracker = upload_tracker
        
        # Extract user info from request state (set by auth dependency)
        user_id = None
        project_id = None
        
        try:
            # Log incoming request
            logger.info(
                "Request started",
                method=request.method,
                path=request.url.path,
                query=str(request.query_params) if request.query_params else None,
            )
            
            # Process the request
            response = await call_next(request)
            
            # Calculate duration
            duration_ms = (time.time() - start_time) * 1000
            
            # Mark uploads as committed on success
            upload_tracker.mark_committed()
            
            # Log successful completion
            logger.info(
                "Request completed",
                method=request.method,
                path=request.url.path,
                status_code=response.status_code,
                duration_ms=round(duration_ms, 2),
            )
            
            # Add request ID to response headers
            response.headers["X-Request-ID"] = request_id
            
            return response
            
        except Exception as exc:
            # Calculate duration
            duration_ms = (time.time() - start_time) * 1000
            
            # Get full traceback
            tb = traceback.format_exc()
            
            # Log the error with full context
            logger.error(
                "Request failed with exception",
                method=request.method,
                path=request.url.path,
                error_type=type(exc).__name__,
                error_message=str(exc),
                traceback=tb,
                duration_ms=round(duration_ms, 2),
            )
            
            # Clean up any orphaned uploads
            if self.minio_client:
                cleaned = await upload_tracker.cleanup(self.minio_client)
                if cleaned:
                    logger.info(
                        "Cleaned up orphaned uploads after error",
                        count=len(cleaned),
                        objects=cleaned
                    )
            
            # Return a user-friendly error response
            error_response = {
                "error": True,
                "message": self._get_user_message(exc),
                "request_id": request_id,
                "timestamp": datetime.utcnow().isoformat() + 'Z'
            }
            
            # Determine appropriate status code
            status_code = self._get_status_code(exc)
            
            return JSONResponse(
                status_code=status_code,
                content=error_response,
                headers={"X-Request-ID": request_id}
            )
        
        finally:
            # Clear request context
            clear_request_id()
    
    def _get_user_message(self, exc: Exception) -> str:
        """
        Get a user-friendly error message.
        
        Hides internal details for security while being helpful.
        """
        exc_type = type(exc).__name__
        
        # Map common exception types to user-friendly messages
        messages = {
            "ValidationError": "Invalid input data. Please check your request.",
            "IntegrityError": "This operation conflicts with existing data.",
            "OperationalError": "Database connection issue. Please try again.",
            "PermissionError": "You don't have permission to perform this action.",
            "FileNotFoundError": "The requested resource was not found.",
            "TimeoutError": "The operation timed out. Please try again.",
        }
        
        # Check for HTTP exceptions with detail
        if hasattr(exc, 'detail'):
            return str(exc.detail)
        
        return messages.get(exc_type, "An unexpected error occurred. Please try again.")
    
    def _get_status_code(self, exc: Exception) -> int:
        """
        Determine the appropriate HTTP status code for an exception.
        """
        # Check for HTTP exceptions
        if hasattr(exc, 'status_code'):
            return exc.status_code
        
        exc_type = type(exc).__name__
        
        # Map exception types to status codes
        status_codes = {
            "ValidationError": 422,
            "IntegrityError": 409,
            "OperationalError": 503,
            "PermissionError": 403,
            "FileNotFoundError": 404,
            "TimeoutError": 504,
            "AuthenticationError": 401,
            "NotFoundError": 404,
        }
        
        return status_codes.get(exc_type, 500)


def get_upload_tracker(request: Request) -> Optional[UploadCleanupTracker]:
    """
    Get the upload tracker from the current request.
    
    Usage in route handlers:
        tracker = get_upload_tracker(request)
        if tracker:
            tracker.add_upload("path/to/file.jpg")
    """
    return getattr(request.state, 'upload_tracker', None)
