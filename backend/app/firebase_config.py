"""
Firebase Admin SDK initialization and token verification.
Sets up credentials from env vars and provides a helper to
verify Firebase ID tokens.

STRATUM - Proprietary and Confidential
Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
All rights reserved.
No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
"""

import firebase_admin
from firebase_admin import auth, credentials

from app.config import settings

_firebase_ready = False
_firebase_error: str | None = None


def firebase_is_ready() -> bool:
    """Return whether Firebase Admin SDK is initialized and usable."""
    return _firebase_ready


def get_firebase_status() -> dict[str, str | bool | None]:
    """Return Firebase availability information for health/capability APIs."""
    return {
        "enabled": settings.firebase_auth_enabled,
        "ready": _firebase_ready,
        "error": _firebase_error,
    }


def initialize_firebase(*, strict: bool = True) -> bool:
    """Initialize Firebase Admin SDK and return readiness state.

    If strict is True, initialization failures are raised.
    """
    global _firebase_ready, _firebase_error

    if not settings.firebase_auth_enabled:
        _firebase_ready = False
        _firebase_error = "Firebase auth disabled by AUTH_MODE"
        print("i Firebase initialization skipped (AUTH_MODE disables Firebase)")
        return False

    try:
        # Reuse app if already initialized (e.g. reload/dev loops).
        if firebase_admin._apps:
            _firebase_ready = True
            _firebase_error = None
            return True

        # Create credentials from environment variables
        cred_dict = {
            "type": "service_account",
            "project_id": settings.FIREBASE_PROJECT_ID,
            "private_key_id": settings.FIREBASE_PRIVATE_KEY_ID,
            "private_key": (settings.FIREBASE_PRIVATE_KEY or "").replace("\\n", "\n"),
            "client_email": settings.FIREBASE_CLIENT_EMAIL,
            "client_id": settings.FIREBASE_CLIENT_ID,
            "auth_uri": settings.FIREBASE_AUTH_URI,
            "token_uri": settings.FIREBASE_TOKEN_URI,
            "auth_provider_x509_cert_url": settings.FIREBASE_AUTH_PROVIDER_CERT_URL,
            "client_x509_cert_url": settings.FIREBASE_CLIENT_CERT_URL,
        }

        cred = credentials.Certificate(cred_dict)
        firebase_admin.initialize_app(cred)
        _firebase_ready = True
        _firebase_error = None
        print("✓ Firebase initialized successfully")
        return True
    except Exception as e:
        _firebase_ready = False
        _firebase_error = str(e)
        print(f"✗ Firebase initialization failed: {e}")
        if strict:
            raise
        return False


async def verify_firebase_token(token: str) -> dict:
    """Verify Firebase ID token and return user info"""
    if not _firebase_ready:
        return None  # type: ignore

    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        print(f"Token verification error: {e}")
        return None  # type: ignore
