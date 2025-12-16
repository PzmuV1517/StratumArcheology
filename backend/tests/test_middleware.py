"""
Tests for STRATUM Backend Middleware

Tests the error handling and logging middleware including:
- Request ID generation
- Error response formatting
- Upload cleanup tracking

Run with: pytest backend/tests/test_middleware.py -v
"""
import pytest
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime
from app.middleware.logging_config import (
    LogContext,
    set_request_id,
    clear_request_id,
    get_logger,
    configure_logging,
    _request_id,
    _log_context,
)
from app.middleware.error_handler import (
    UploadCleanupTracker,
    ErrorHandlingMiddleware,
    get_upload_tracker,
)


class TestLogContext:
    """Tests for structured logging context"""

    def test_log_context_sets_values(self):
        """Test LogContext sets context values"""
        with LogContext(user_id='user123', project_id='proj456'):
            context = _log_context.get()
            assert context.get('user_id') == 'user123'
            assert context.get('project_id') == 'proj456'

    def test_log_context_restores_previous(self):
        """Test LogContext restores previous context on exit"""
        _log_context.set({'existing': 'value'})
        
        with LogContext(user_id='user123'):
            pass
        
        context = _log_context.get()
        assert context.get('existing') == 'value'
        assert 'user_id' not in context

    def test_log_context_nested(self):
        """Test nested LogContext works correctly"""
        with LogContext(user_id='user123'):
            with LogContext(project_id='proj456'):
                context = _log_context.get()
                assert context.get('user_id') == 'user123'
                assert context.get('project_id') == 'proj456'
            
            # After inner context exits
            context = _log_context.get()
            assert context.get('user_id') == 'user123'
            assert 'project_id' not in context

    def test_request_id_generation(self):
        """Test request ID generation"""
        request_id = set_request_id()
        assert request_id is not None
        assert len(request_id) == 8  # Short UUID format
        
        current = _request_id.get()
        assert current == request_id

    def test_request_id_custom(self):
        """Test custom request ID is used"""
        custom_id = 'my-custom-id'
        result = set_request_id(custom_id)
        assert result == custom_id
        assert _request_id.get() == custom_id

    def test_clear_request_id(self):
        """Test request ID clearing"""
        set_request_id('test-id')
        clear_request_id()
        assert _request_id.get() is None


class TestUploadCleanupTracker:
    """Tests for upload cleanup tracking"""

    def test_add_upload(self):
        """Test adding uploads to tracker"""
        tracker = UploadCleanupTracker()
        tracker.add_upload('path/to/file1.jpg')
        tracker.add_upload('path/to/file2.jpg')
        
        assert len(tracker._uploads) == 2

    def test_mark_committed_single(self):
        """Test marking single upload as committed"""
        tracker = UploadCleanupTracker()
        tracker.add_upload('path/to/file1.jpg')
        tracker.add_upload('path/to/file2.jpg')
        
        tracker.mark_committed('path/to/file1.jpg')
        
        assert 'path/to/file1.jpg' not in tracker._uploads
        assert 'path/to/file2.jpg' in tracker._uploads

    def test_mark_committed_all(self):
        """Test marking all uploads as committed"""
        tracker = UploadCleanupTracker()
        tracker.add_upload('path/to/file1.jpg')
        tracker.add_upload('path/to/file2.jpg')
        
        tracker.mark_committed()
        
        assert len(tracker._uploads) == 0

    @pytest.mark.asyncio
    async def test_cleanup_calls_delete(self):
        """Test cleanup calls MinIO delete for each upload"""
        tracker = UploadCleanupTracker()
        tracker.add_upload('path/to/file1.jpg')
        tracker.add_upload('path/to/file2.jpg')
        
        mock_minio = AsyncMock()
        mock_minio.delete_file = AsyncMock(return_value=True)
        
        cleaned = await tracker.cleanup(mock_minio)
        
        assert len(cleaned) == 2
        assert mock_minio.delete_file.call_count == 2

    @pytest.mark.asyncio
    async def test_cleanup_handles_errors(self):
        """Test cleanup handles delete errors gracefully"""
        tracker = UploadCleanupTracker()
        tracker.add_upload('path/to/file1.jpg')
        
        mock_minio = AsyncMock()
        mock_minio.delete_file = AsyncMock(side_effect=Exception("Delete failed"))
        
        # Should not raise
        cleaned = await tracker.cleanup(mock_minio)
        
        # Should return empty since delete failed
        assert len(cleaned) == 0


class TestErrorHandlingMiddleware:
    """Tests for error handling middleware"""

    def test_get_user_message_validation(self):
        """Test user-friendly message for ValidationError"""
        middleware = ErrorHandlingMiddleware(app=Mock())
        
        class MockValidationError(Exception):
            pass
        
        error = MockValidationError()
        error.__class__.__name__ = 'ValidationError'
        
        message = middleware._get_user_message(error)
        assert 'Invalid input' in message

    def test_get_user_message_http_exception(self):
        """Test user-friendly message uses HTTP exception detail"""
        middleware = ErrorHandlingMiddleware(app=Mock())
        
        class MockHTTPError(Exception):
            detail = "Custom error message"
        
        error = MockHTTPError()
        message = middleware._get_user_message(error)
        assert message == "Custom error message"

    def test_get_status_code_validation(self):
        """Test status code for ValidationError"""
        middleware = ErrorHandlingMiddleware(app=Mock())
        
        class MockError(Exception):
            pass
        
        error = MockError()
        error.__class__.__name__ = 'ValidationError'
        
        status = middleware._get_status_code(error)
        assert status == 422

    def test_get_status_code_http_exception(self):
        """Test status code from HTTP exception"""
        middleware = ErrorHandlingMiddleware(app=Mock())
        
        class MockHTTPError(Exception):
            status_code = 403
        
        error = MockHTTPError()
        status = middleware._get_status_code(error)
        assert status == 403

    def test_get_status_code_unknown(self):
        """Test status code defaults to 500 for unknown errors"""
        middleware = ErrorHandlingMiddleware(app=Mock())
        
        error = Exception("Unknown error")
        status = middleware._get_status_code(error)
        assert status == 500


class TestLogger:
    """Tests for logger configuration"""

    def test_configure_logging_debug(self):
        """Test logging configuration in debug mode"""
        configure_logging(debug=True)
        logger = get_logger('test')
        assert logger is not None

    def test_configure_logging_production(self):
        """Test logging configuration in production mode"""
        configure_logging(debug=False)
        logger = get_logger('test')
        assert logger is not None

    def test_get_logger_returns_bound_logger(self):
        """Test get_logger returns a structlog logger"""
        configure_logging(debug=True)
        logger = get_logger('test.module')
        assert logger is not None
        # Should have typical logger methods
        assert hasattr(logger, 'info')
        assert hasattr(logger, 'error')
        assert hasattr(logger, 'warning')


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
