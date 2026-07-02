"""
Tests for STRATUM Backend Validation Layer

Tests the validation module including:
- GPS coordinate validation
- File type validation (magic bytes)
- String sanitization
- SQL injection prevention

Run with: pytest backend/tests/test_validation.py -v


STRATUM - Proprietary and Confidential
Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
All rights reserved.
No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
"""

import pytest
from pydantic import ValidationError as PydanticValidationError

from app.validation import (
    FileUploadRequest,
    GPSPoint,
    GPSPolygon,
    NoteCreateValidated,
    ProjectCreateValidated,
    ValidationError,
    detect_mime_type_from_bytes,
    escape_like_pattern,
    is_safe_identifier,
    sanitize_filename,
    sanitize_string,
    validate_file_type,
    validate_gps_coordinates,
    validate_gps_latitude,
    validate_gps_longitude,
)


class TestGPSValidation:
    """Tests for GPS coordinate validation"""

    def test_valid_latitude(self):
        """Test valid latitude values"""
        assert validate_gps_latitude(0) == 0
        assert validate_gps_latitude(45.5) == 45.5
        assert validate_gps_latitude(-90) == -90
        assert validate_gps_latitude(90) == 90

    def test_invalid_latitude(self):
        """Test invalid latitude values raise errors"""
        with pytest.raises(ValueError, match="Latitude must be between"):
            validate_gps_latitude(91)
        with pytest.raises(ValueError, match="Latitude must be between"):
            validate_gps_latitude(-91)
        with pytest.raises(ValueError, match="Latitude must be between"):
            validate_gps_latitude(180)

    def test_valid_longitude(self):
        """Test valid longitude values"""
        assert validate_gps_longitude(0) == 0
        assert validate_gps_longitude(90) == 90
        assert validate_gps_longitude(-180) == -180
        assert validate_gps_longitude(180) == 180

    def test_invalid_longitude(self):
        """Test invalid longitude values raise errors"""
        with pytest.raises(ValueError, match="Longitude must be between"):
            validate_gps_longitude(181)
        with pytest.raises(ValueError, match="Longitude must be between"):
            validate_gps_longitude(-181)

    def test_coordinate_pair(self):
        """Test coordinate pair validation"""
        lat, lon = validate_gps_coordinates(45.5, -122.5)
        assert lat == 45.5
        assert lon == -122.5

    def test_gps_point_model(self):
        """Test GPSPoint Pydantic model validation"""
        point = GPSPoint(latitude=45.5, longitude=-122.5)
        assert point.latitude == 45.5
        assert point.longitude == -122.5

    def test_gps_point_invalid(self):
        """Test GPSPoint rejects invalid coordinates"""
        with pytest.raises(PydanticValidationError):
            GPSPoint(latitude=91, longitude=0)
        with pytest.raises(PydanticValidationError):
            GPSPoint(latitude=0, longitude=181)

    def test_gps_polygon_valid(self):
        """Test GPSPolygon with valid points"""
        points = [
            GPSPoint(latitude=45.0, longitude=-122.0),
            GPSPoint(latitude=45.1, longitude=-122.0),
            GPSPoint(latitude=45.1, longitude=-122.1),
        ]
        polygon = GPSPolygon(points=points)
        assert len(polygon.points) == 3

    def test_gps_polygon_too_few_points(self):
        """Test GPSPolygon requires at least 3 points"""
        points = [
            GPSPoint(latitude=45.0, longitude=-122.0),
            GPSPoint(latitude=45.1, longitude=-122.0),
        ]
        with pytest.raises(PydanticValidationError):
            GPSPolygon(points=points)


class TestFileTypeValidation:
    """Tests for file type and magic bytes validation"""

    def test_detect_jpeg(self):
        """Test JPEG detection from magic bytes"""
        jpeg_header = b"\xff\xd8\xff\xe0\x00\x10JFIF"
        assert detect_mime_type_from_bytes(jpeg_header) == "image/jpeg"

    def test_detect_png(self):
        """Test PNG detection from magic bytes"""
        png_header = b"\x89PNG\r\n\x1a\n\x00\x00\x00"
        assert detect_mime_type_from_bytes(png_header) == "image/png"

    def test_detect_pdf(self):
        """Test PDF detection from magic bytes"""
        pdf_header = b"%PDF-1.4\n"
        assert detect_mime_type_from_bytes(pdf_header) == "application/pdf"

    def test_detect_unknown(self):
        """Test unknown file type returns None"""
        random_bytes = b"\x00\x01\x02\x03\x04\x05"
        assert detect_mime_type_from_bytes(random_bytes) is None

    def test_validate_allowed_type(self):
        """Test validation passes for allowed types"""
        jpeg_data = b"\xff\xd8\xff\xe0" + b"\x00" * 100
        result = validate_file_type(jpeg_data, "photo.jpg")
        assert result == "image/jpeg"

    def test_validate_blocked_extension(self):
        """Test validation blocks dangerous extensions"""
        with pytest.raises(ValidationError, match="not allowed for security"):
            validate_file_type(b"some data", "malware.exe")
        with pytest.raises(ValidationError, match="not allowed for security"):
            validate_file_type(b"some data", "script.ps1")
        with pytest.raises(ValidationError, match="not allowed for security"):
            validate_file_type(b"some data", "hack.bat")


class TestStringSanitization:
    """Tests for string sanitization"""

    def test_strip_whitespace(self):
        """Test whitespace is stripped"""
        assert sanitize_string("  hello  ") == "hello"
        assert sanitize_string("\n\thello\n\t") == "hello"

    def test_remove_null_bytes(self):
        """Test null bytes are removed"""
        assert sanitize_string("hello\x00world") == "helloworld"

    def test_length_limit(self):
        """Test string is truncated to max length"""
        long_string = "a" * 2000
        result = sanitize_string(long_string, max_length=100)
        assert len(result) == 100

    def test_custom_max_length(self):
        """Test custom max length"""
        result = sanitize_string("hello world", max_length=5)
        assert result == "hello"


class TestFilenameSanitization:
    """Tests for filename sanitization"""

    def test_remove_path_traversal(self):
        """Test path traversal attempts are blocked"""
        assert sanitize_filename("../../../etc/passwd") == "passwd"
        assert sanitize_filename("..\\..\\windows\\system32\\config") == "config"

    def test_remove_dangerous_chars(self):
        """Test dangerous characters are replaced"""
        assert sanitize_filename("file<name>.txt") == "file_name_.txt"
        assert sanitize_filename("file|name.txt") == "file_name.txt"

    def test_preserve_extension(self):
        """Test file extension is preserved"""
        result = sanitize_filename("a" * 300 + ".jpg")
        assert result.endswith(".jpg")
        assert len(result) <= 255

    def test_empty_filename_default(self):
        """Test empty filename gets default"""
        assert sanitize_filename("") == "unnamed_file"
        assert sanitize_filename("...") == "unnamed_file"


class TestSQLInjectionPrevention:
    """Tests for SQL injection prevention utilities"""

    def test_safe_identifier_valid(self):
        """Test valid identifiers pass"""
        assert is_safe_identifier("column_name") is True
        assert is_safe_identifier("Table123") is True
        assert is_safe_identifier("_private") is True

    def test_safe_identifier_invalid(self):
        """Test invalid identifiers are rejected"""
        assert is_safe_identifier("DROP TABLE") is False
        assert is_safe_identifier("column; --") is False
        assert is_safe_identifier("column'") is False
        assert is_safe_identifier("123column") is False

    def test_escape_like_pattern(self):
        """Test LIKE pattern escaping"""
        assert escape_like_pattern("100%") == "100\\%"
        assert escape_like_pattern("under_score") == "under\\_score"
        assert escape_like_pattern("back\\slash") == "back\\\\slash"
        assert escape_like_pattern("normal") == "normal"


class TestPydanticModels:
    """Tests for Pydantic validation models"""

    def test_file_upload_sanitizes_filename(self):
        """Test FileUploadRequest sanitizes filename"""
        request = FileUploadRequest(
            filename="../../../etc/passwd", mime_type="text/plain"
        )
        assert request.filename == "passwd"

    def test_file_upload_size_limit(self):
        """Test FileUploadRequest rejects oversized files"""
        with pytest.raises(PydanticValidationError):
            FileUploadRequest(
                filename="huge.zip",
                mime_type="application/zip",
                size=600 * 1024 * 1024,  # 600 MB
            )

    def test_note_create_validates(self):
        """Test NoteCreateValidated sanitizes input"""
        note = NoteCreateValidated(
            title="  Test Note  ",
            content='<script>alert("xss")</script>',
            project_id="abc123",
        )
        assert note.title == "Test Note"

    def test_note_create_empty_title_fails(self):
        """Test empty title is rejected"""
        with pytest.raises(PydanticValidationError):
            NoteCreateValidated(
                title="   ",  # Only whitespace
                project_id="abc123",
            )

    def test_project_create_validates(self):
        """Test ProjectCreateValidated validates input"""
        project = ProjectCreateValidated(
            name="Test Project", description="A test project", ran_lmi_id="RAN-123"
        )
        assert project.name == "Test Project"
        assert project.ran_lmi_id == "RAN-123"

    def test_project_name_too_short(self):
        """Test project name minimum length"""
        with pytest.raises(PydanticValidationError):
            ProjectCreateValidated(name="A")

    def test_project_ran_lmi_invalid_chars(self):
        """Test RAN-LMI ID rejects invalid characters"""
        with pytest.raises(PydanticValidationError):
            ProjectCreateValidated(
                name="Test Project", ran_lmi_id="RAN; DROP TABLE--"
            )


class TestEdgeCases:
    """Tests for edge cases and boundary conditions"""

    def test_boundary_coordinates(self):
        """Test boundary GPS values"""
        # Exact boundary values should work
        assert validate_gps_latitude(90) == 90
        assert validate_gps_latitude(-90) == -90
        assert validate_gps_longitude(180) == 180
        assert validate_gps_longitude(-180) == -180

    def test_unicode_sanitization(self):
        """Test unicode handling in sanitization"""
        result = sanitize_string("Café résumé 日本語")
        assert "Café" in result
        assert "日本語" in result

    def test_very_long_content(self):
        """Test very long content is handled"""
        long_content = "x" * 200000  # 200KB
        result = sanitize_string(long_content, max_length=100000)
        assert len(result) == 100000

    def test_empty_inputs(self):
        """Test empty inputs are handled gracefully"""
        assert sanitize_string("") == ""
        assert sanitize_filename(" ") == "unnamed_file"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
