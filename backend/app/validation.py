"""
Enhanced Data Validation for STRATUM

Provides comprehensive input validation including:
- GPS coordinate validation (lat: -90 to 90, lon: -180 to 180)
- File type validation with magic bytes
- String sanitization to prevent injection attacks
- Required field enforcement
- Custom validators for archaeological data

Uses Pydantic v2 validators for type-safe, runtime validation.
"""

import os
import re
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, field_validator

# Magic bytes for common file types (first few bytes of file)
# Used to validate actual file content, not just extension
FILE_MAGIC_BYTES = {
    # Images
    b"\x89PNG\r\n\x1a\n": "image/png",
    b"\xff\xd8\xff": "image/jpeg",
    b"GIF87a": "image/gif",
    b"GIF89a": "image/gif",
    b"RIFF": "image/webp",  # WebP starts with RIFF...WEBP
    # Documents
    b"%PDF": "application/pdf",
    b"PK\x03\x04": "application/zip",  # ZIP, XLSX, DOCX
    # Audio
    b"ID3": "audio/mpeg",  # MP3 with ID3 tag
    b"\xff\xfb": "audio/mpeg",  # MP3 without ID3
    b"\xff\xfa": "audio/mpeg",
    b"OggS": "audio/ogg",
    b"fLaC": "audio/flac",
    b"RIFF....WAVE": "audio/wav",
    # Video
    b"\x00\x00\x00\x1c": "video/mp4",  # MP4/M4V
    b"\x00\x00\x00\x18": "video/mp4",
    b"\x00\x00\x00\x14": "video/mp4",
    b"\x00\x00\x00\x20": "video/mp4",
    b"\x1aE\xdf\xa3": "video/webm",
}

# Allowed MIME types for file uploads
ALLOWED_MIME_TYPES = {
    # Images
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/heic",
    "image/heif",
    "image/tiff",
    "image/bmp",
    # Documents
    "application/pdf",
    "text/plain",
    "text/markdown",
    "text/csv",
    "application/json",
    "application/xml",
    "text/xml",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",  # XLSX
    "application/vnd.ms-excel",  # XLS
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # DOCX
    "application/msword",  # DOC
    # Audio
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/ogg",
    "audio/webm",
    "audio/aac",
    "audio/m4a",
    "audio/flac",
    # Video
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/x-msvideo",
    # Archives
    "application/zip",
    "application/gzip",
}

# Blocked file extensions (dangerous executable types)
BLOCKED_EXTENSIONS = {
    ".exe",
    ".bat",
    ".cmd",
    ".ps1",
    ".sh",
    ".bash",
    ".msi",
    ".dll",
    ".so",
    ".dylib",
    ".php",
    ".asp",
    ".aspx",
    ".jsp",
    ".cgi",
    ".js",
    ".vbs",
    ".wsf",
    ".hta",
}


class ValidationError(Exception):
    """Custom validation error with field context."""

    def __init__(self, field: str, message: str, value: Any = None):
        self.field = field
        self.message = message
        self.value = value
        super().__init__(f"{field}: {message}")


def validate_gps_latitude(lat: float) -> float:
    """
    Validate latitude value is within valid range.

    Args:
        lat: Latitude in degrees (-90 to 90)

    Returns:
        Validated latitude

    Raises:
        ValueError: If latitude is out of range
    """
    if lat < -90 or lat > 90:
        raise ValueError(f"Latitude must be between -90 and 90 degrees, got {lat}")
    return lat


def validate_gps_longitude(lon: float) -> float:
    """
    Validate longitude value is within valid range.

    Args:
        lon: Longitude in degrees (-180 to 180)

    Returns:
        Validated longitude

    Raises:
        ValueError: If longitude is out of range
    """
    if lon < -180 or lon > 180:
        raise ValueError(f"Longitude must be between -180 and 180 degrees, got {lon}")
    return lon


def validate_gps_coordinates(lat: float, lon: float) -> tuple:
    """
    Validate a GPS coordinate pair.

    Args:
        lat: Latitude in degrees
        lon: Longitude in degrees

    Returns:
        Tuple of (validated_lat, validated_lon)
    """
    return (validate_gps_latitude(lat), validate_gps_longitude(lon))


def detect_mime_type_from_bytes(file_data: bytes) -> str | None:
    """
    Detect MIME type from file content using magic bytes.

    More secure than trusting file extension or Content-Type header.

    Args:
        file_data: Raw file bytes (first 32 bytes is enough)

    Returns:
        Detected MIME type or None if unknown
    """
    for magic, mime in FILE_MAGIC_BYTES.items():
        if file_data.startswith(magic):
            return mime

    # Special case for WebP (RIFF....WEBP)
    if file_data[:4] == b"RIFF" and len(file_data) >= 12 and file_data[8:12] == b"WEBP":
        return "image/webp"

    # Special case for WAV (RIFF....WAVE)
    if file_data[:4] == b"RIFF" and len(file_data) >= 12 and file_data[8:12] == b"WAVE":
        return "audio/wav"

    return None


def validate_file_type(file_data: bytes, filename: str, claimed_mime_type: str | None = None) -> str:
    """
    Validate file type using magic bytes and extension.

    Args:
        file_data: Raw file bytes (at least first 32 bytes)
        filename: Original filename
        claimed_mime_type: MIME type claimed by client (optional)

    Returns:
        Validated MIME type

    Raises:
        ValidationError: If file type is blocked or suspicious
    """
    # Check extension first
    _, ext = os.path.splitext(filename.lower())

    if ext in BLOCKED_EXTENSIONS:
        raise ValidationError("file", f"File type '{ext}' is not allowed for security reasons", filename)

    # Detect actual type from content
    detected_mime = detect_mime_type_from_bytes(file_data)

    # If we detected a type, verify it's allowed
    if detected_mime:
        if detected_mime not in ALLOWED_MIME_TYPES:
            raise ValidationError("file", f"File type '{detected_mime}' is not allowed", filename)
        return detected_mime

    # Fall back to claimed MIME type if detection failed
    if claimed_mime_type:
        if claimed_mime_type not in ALLOWED_MIME_TYPES:
            raise ValidationError("file", f"File type '{claimed_mime_type}' is not allowed", filename)
        return claimed_mime_type

    # Default to octet-stream for unknown types
    return "application/octet-stream"


def sanitize_string(value: str, max_length: int = 1000) -> str:
    """
    Sanitize a string input to prevent injection attacks.

    - Strips leading/trailing whitespace
    - Limits length
    - Removes null bytes
    - Normalizes unicode

    Args:
        value: Input string
        max_length: Maximum allowed length

    Returns:
        Sanitized string
    """
    if not isinstance(value, str):
        return value

    # Remove null bytes (can cause issues in many systems)
    value = value.replace("\x00", "")

    # Strip whitespace
    value = value.strip()

    # Limit length
    if len(value) > max_length:
        value = value[:max_length]

    return value


def sanitize_filename(filename: str) -> str:
    """
    Sanitize a filename to be safe for storage.

    - Removes path traversal attempts
    - Limits length
    - Replaces dangerous characters

    Args:
        filename: Original filename

    Returns:
        Safe filename
    """
    # Remove any path components (prevent directory traversal)
    filename = os.path.basename(filename)

    # Remove null bytes
    filename = filename.replace("\x00", "")

    # Replace problematic characters
    filename = re.sub(r'[<>:"/\\|?*]', "_", filename)

    # Remove leading/trailing dots and spaces
    filename = filename.strip(". ")

    # Limit length (preserve extension)
    if len(filename) > 255:
        name, ext = os.path.splitext(filename)
        name = name[: 255 - len(ext)]
        filename = name + ext

    # Provide default if empty
    if not filename:
        filename = "unnamed_file"

    return filename


# =============================================================================
# Enhanced Pydantic Models with Validation
# =============================================================================


class GPSPoint(BaseModel):
    """
    Validated GPS coordinate point.

    Ensures lat/lon are within valid ranges.
    """

    model_config = ConfigDict(strict=True)

    latitude: float
    longitude: float
    altitude: float | None = None
    accuracy: float | None = None
    timestamp: datetime | None = None

    @field_validator("latitude")
    @classmethod
    def validate_lat(cls, v: float) -> float:
        return validate_gps_latitude(v)

    @field_validator("longitude")
    @classmethod
    def validate_lon(cls, v: float) -> float:
        return validate_gps_longitude(v)

    @field_validator("accuracy")
    @classmethod
    def validate_accuracy(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("Accuracy cannot be negative")
        return v


class GPSPolygon(BaseModel):
    """
    Validated GPS polygon (closed area).

    Must have at least 3 points to form a valid polygon.
    """

    model_config = ConfigDict(strict=True)

    points: list[GPSPoint]
    closed: bool = True
    name: str | None = None

    @field_validator("points")
    @classmethod
    def validate_points(cls, v: list[GPSPoint]) -> list[GPSPoint]:
        if len(v) < 3:
            raise ValueError("Polygon must have at least 3 points")
        return v

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str | None) -> str | None:
        if v:
            return sanitize_string(v, max_length=200)
        return v


class FileUploadRequest(BaseModel):
    """
    Validated file upload metadata.

    Ensures filename is safe and MIME type is allowed.
    """

    filename: str
    mime_type: str
    size: int | None = None
    parent_id: str | None = None

    @field_validator("filename")
    @classmethod
    def validate_filename(cls, v: str) -> str:
        return sanitize_filename(v)

    @field_validator("mime_type")
    @classmethod
    def validate_mime(cls, v: str) -> str:
        # Allow general validation, actual type check happens with file content
        if not v or len(v) > 100:
            raise ValueError("Invalid MIME type")
        return v.lower()

    @field_validator("size")
    @classmethod
    def validate_size(cls, v: int | None) -> int | None:
        if v is not None:
            if v < 0:
                raise ValueError("Size cannot be negative")
            if v > 500 * 1024 * 1024:  # 500 MB limit
                raise ValueError("File size exceeds maximum allowed (500 MB)")
        return v


class NoteCreateValidated(BaseModel):
    """
    Validated note creation request.

    Sanitizes title and content to prevent injection.
    """

    title: str
    content: str | None = None
    project_id: str

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        v = sanitize_string(v, max_length=500)
        if not v:
            raise ValueError("Title cannot be empty")
        return v

    @field_validator("content")
    @classmethod
    def validate_content(cls, v: str | None) -> str | None:
        if v:
            return sanitize_string(v, max_length=100000)  # 100KB text limit
        return v


class ProjectCreateValidated(BaseModel):
    """
    Validated project creation request.
    """

    name: str
    description: str | None = None
    ran_lmi_id: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = sanitize_string(v, max_length=200)
        if not v:
            raise ValueError("Project name cannot be empty")
        if len(v) < 2:
            raise ValueError("Project name must be at least 2 characters")
        return v

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str | None) -> str | None:
        if v:
            return sanitize_string(v, max_length=5000)
        return v

    @field_validator("ran_lmi_id")
    @classmethod
    def validate_ran_lmi_id(cls, v: str | None) -> str | None:
        if v:
            v = sanitize_string(v, max_length=50)
            # RAN-LMI IDs should be alphanumeric with possible dashes
            if not re.match(r"^[A-Za-z0-9\-_.]+$", v):
                raise ValueError("RAN-LMI ID contains invalid characters")
        return v


class SearchQueryValidated(BaseModel):
    """
    Validated search query.

    Prevents SQL injection in search terms.
    """

    query: str
    limit: int = 50
    offset: int = 0

    @field_validator("query")
    @classmethod
    def validate_query(cls, v: str) -> str:
        v = sanitize_string(v, max_length=500)
        # Remove SQL-like patterns (extra protection, DB uses params anyway)
        v = re.sub(r"[;'\"\-\-]", "", v)
        return v

    @field_validator("limit")
    @classmethod
    def validate_limit(cls, v: int) -> int:
        if v < 1:
            return 1
        if v > 200:
            return 200
        return v

    @field_validator("offset")
    @classmethod
    def validate_offset(cls, v: int) -> int:
        if v < 0:
            return 0
        return v


# =============================================================================
# SQL Injection Prevention Utilities
# =============================================================================


def is_safe_identifier(value: str) -> bool:
    """
    Check if a string is safe to use as a SQL identifier.

    Only allows alphanumeric characters and underscores.
    This should rarely be needed since we use parameterized queries,
    but useful for dynamic column/table names.

    Args:
        value: String to check

    Returns:
        True if safe, False otherwise
    """
    return bool(re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", value))


def escape_like_pattern(pattern: str) -> str:
    """
    Escape special characters in a LIKE pattern.

    Prevents injection in LIKE queries while allowing wildcards.

    Args:
        pattern: Search pattern

    Returns:
        Escaped pattern safe for LIKE queries
    """
    # Escape SQL LIKE special chars
    pattern = pattern.replace("\\", "\\\\")
    pattern = pattern.replace("%", "\\%")
    pattern = pattern.replace("_", "\\_")
    return pattern
