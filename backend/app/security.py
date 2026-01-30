"""
Security Module for STRATUM API

This module provides comprehensive security features:
- JWT token creation and validation
- Password hashing (for future use)
- Security headers middleware
- Request validation utilities
- Token blacklist management

Uses python-jose for JWT handling with enhanced security.
"""

import secrets
from datetime import datetime, timedelta
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

from app.config import settings

# =============================================================================
# PASSWORD HASHING
# =============================================================================

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12,  # Increased rounds for better security
)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password for storage."""
    return pwd_context.hash(password)


# =============================================================================
# JWT TOKEN HANDLING
# =============================================================================

# Token type constants
ACCESS_TOKEN_TYPE = "access"
REFRESH_TOKEN_TYPE = "refresh"

# Algorithm for JWT
ALGORITHM = "HS256"


class TokenPayload(BaseModel):
    """Structured JWT token payload."""

    user_id: str
    firebase_uid: str
    email: str
    token_type: str = ACCESS_TOKEN_TYPE
    exp: datetime | None = None
    iat: datetime | None = None
    jti: str | None = None  # JWT ID for token revocation


def create_access_token(
    user_id: str,
    firebase_uid: str,
    email: str,
    expires_delta: timedelta | None = None,
) -> str:
    """
    Create a JWT access token with enhanced security.

    Args:
        user_id: The user's database ID
        firebase_uid: The user's Firebase UID
        email: The user's email
        expires_delta: Optional custom expiration time

    Returns:
        Encoded JWT token string
    """
    now = datetime.utcnow()

    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(hours=settings.JWT_EXPIRATION_HOURS)

    payload = {
        "user_id": user_id,
        "firebase_uid": firebase_uid,
        "email": email,
        "token_type": ACCESS_TOKEN_TYPE,
        "exp": expire,
        "iat": now,
        "jti": secrets.token_urlsafe(16),  # Unique token ID
    }

    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(
    user_id: str,
    firebase_uid: str,
    email: str,
) -> str:
    """
    Create a refresh token with longer expiration.

    Args:
        user_id: The user's database ID
        firebase_uid: The user's Firebase UID
        email: The user's email

    Returns:
        Encoded JWT refresh token string
    """
    now = datetime.utcnow()
    # Refresh tokens last 7 days
    expire = now + timedelta(days=7)

    payload = {
        "user_id": user_id,
        "firebase_uid": firebase_uid,
        "email": email,
        "token_type": REFRESH_TOKEN_TYPE,
        "exp": expire,
        "iat": now,
        "jti": secrets.token_urlsafe(16),
    }

    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict[str, Any] | None:
    """
    Decode and validate a JWT token.

    Args:
        token: The JWT token string

    Returns:
        Decoded payload dict or None if invalid

    Raises:
        JWTError: If token is invalid or expired
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[ALGORITHM],
            options={
                "verify_exp": True,
                "verify_iat": True,
                "require_exp": True,
            },
        )
        return payload
    except JWTError:
        return None


def verify_token(
    token: str, expected_type: str = ACCESS_TOKEN_TYPE
) -> dict[str, Any] | None:
    """
    Verify a token and check its type.

    Args:
        token: The JWT token string
        expected_type: Expected token type (access or refresh)

    Returns:
        Decoded payload if valid, None otherwise
    """
    payload = decode_token(token)
    if payload is None:
        return None

    if payload.get("token_type") != expected_type:
        return None

    return payload


# =============================================================================
# TOKEN BLACKLIST (In-memory for simplicity, use Redis in production)
# =============================================================================

# Simple in-memory blacklist (should use Redis in production)
_token_blacklist: set[str] = set()


def blacklist_token(jti: str) -> None:
    """Add a token ID to the blacklist."""
    _token_blacklist.add(jti)


def is_token_blacklisted(jti: str) -> bool:
    """Check if a token ID is blacklisted."""
    return jti in _token_blacklist


def clear_expired_blacklist() -> None:
    """
    Clear expired tokens from blacklist.
    In production, use Redis with TTL for automatic expiration.
    """
    # This is a placeholder - in production, use Redis TTL
    pass


# =============================================================================
# SECURITY UTILITIES
# =============================================================================


def generate_secure_token(length: int = 32) -> str:
    """Generate a cryptographically secure random token."""
    return secrets.token_urlsafe(length)


def validate_password_strength(password: str) -> tuple[bool, str]:
    """
    Validate password meets security requirements.

    Returns:
        Tuple of (is_valid, error_message)
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"

    if not any(c.isupper() for c in password):
        return False, "Password must contain at least one uppercase letter"

    if not any(c.islower() for c in password):
        return False, "Password must contain at least one lowercase letter"

    if not any(c.isdigit() for c in password):
        return False, "Password must contain at least one digit"

    return True, ""
