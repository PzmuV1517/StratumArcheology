"""
Authentication and user management API routes.

Handles user registration, login (Firebase Auth + JWT), token verification,
profile management, onboarding status, and user search.

STRATUM - Proprietary and Confidential
Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
All rights reserved.
No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
"""

import uuid
from datetime import datetime, timedelta

import firebase_admin.auth as firebase_auth
import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.auth_provider import (
    PASSWORD_PROVIDER_ID,
    choose_primary_auth_provider,
    extract_provider_ids_from_firebase_user,
    infer_auth_provider,
    is_google_provider,
)
from app.config import settings
from app.database import get_db
from app.dependencies import build_maintainer_user, get_current_user
from app.middleware import get_logger
from app.models import User
from app.schemas import (
    AuthResponse,
    FirebaseTokenRequest,
    LoginRequest,
    ProfileUpdateRequest,
    RegisterRequest,
    UserResponse,
)

logger = get_logger(__name__)
router = APIRouter(prefix="/auth", tags=["authentication"])

# Firebase Auth REST API endpoint for email/password sign-in
FIREBASE_SIGN_IN_URL = (
    "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword"
)
FIREBASE_SEND_OOB_URL = (
    "https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode"
)
LOCAL_PROVIDER_ID = "local"
LOCAL_UID_PREFIX = "LOCAL-"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _issue_api_jwt(user_id: str, firebase_uid: str, email: str) -> str:
    payload = {
        "user_id": user_id,
        "firebase_uid": firebase_uid,
        "email": email,
        "exp": datetime.utcnow() + timedelta(hours=settings.JWT_EXPIRATION_HOURS),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm="HS256")


def _ensure_account_active(user: User) -> None:
    if user.is_soft_deleted:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account has been deleted",
        )

    if user.is_account_disabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )


def _ensure_firebase_auth_enabled() -> None:
    if settings.firebase_auth_enabled:
        return

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Firebase authentication is disabled on this server",
    )


def _authenticate_local_user(email: str, password: str, db: Session) -> User | None:
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return None

    if not user.password_hash:
        return None

    if not pwd_context.verify(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    _ensure_account_active(user)

    _set_user_auth_provider(user, LOCAL_PROVIDER_ID)
    user.last_login = datetime.utcnow()
    db.commit()
    return user


def _set_user_auth_provider(user: User, auth_provider: str | None) -> None:
    if auth_provider:
        user.auth_provider = auth_provider


async def verify_password_with_firebase(email: str, password: str) -> dict:
    """Verify email/password credentials against Firebase Auth via REST API.

    Returns the Firebase response dict on success.
    Raises HTTPException(401) on invalid credentials.
    """
    _ensure_firebase_auth_enabled()

    async with httpx.AsyncClient() as client:
        response = await client.post(
            FIREBASE_SIGN_IN_URL,
            params={"key": settings.FIREBASE_WEB_API_KEY},
            json={
                "email": email,
                "password": password,
                "returnSecureToken": True,
            },
            timeout=10.0,
        )

    if response.status_code != 200:
        # Firebase returns 400 for invalid credentials
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    return response.json()


async def send_firebase_oob_code(
    request_type: str,
    *,
    email: str | None = None,
    id_token: str | None = None,
) -> dict:
    """Send Firebase OOB email action (verify email, password reset, etc.)."""
    _ensure_firebase_auth_enabled()

    payload: dict[str, str] = {"requestType": request_type}
    if email:
        payload["email"] = email
    if id_token:
        payload["idToken"] = id_token

    async with httpx.AsyncClient() as client:
        response = await client.post(
            FIREBASE_SEND_OOB_URL,
            params={"key": settings.FIREBASE_WEB_API_KEY},
            json=payload,
            timeout=10.0,
        )

    if response.status_code != 200:
        logger.warning(
            "Firebase OOB action failed",
            request_type=request_type,
            status_code=response.status_code,
            response=response.text,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Firebase email action failed",
        )

    return response.json()


@router.post("/login", response_model=AuthResponse)
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Login with email and password - verified against Firebase Auth."""
    try:
        normalized_email = request.email.strip().lower()

        # Maintainer account is managed from backend env variables.
        if (
            normalized_email == settings.MAINTAINER_EMAIL.strip().lower()
            and request.password == settings.MAINTAINER_PASSWORD
        ):
            maintainer_user = build_maintainer_user()
            jwt_token = _issue_api_jwt(
                user_id="MAINTAINER",
                firebase_uid="MAINTAINER",
                email=settings.MAINTAINER_EMAIL,
            )
            return AuthResponse(
                access_token=jwt_token,
                user=UserResponse.model_validate(maintainer_user),
            )

        # Local auth first (for local mode and local users in hybrid mode).
        if settings.local_auth_enabled:
            local_user = _authenticate_local_user(
                normalized_email, request.password, db
            )
            if local_user:
                jwt_token = _issue_api_jwt(
                    user_id=local_user.id,
                    firebase_uid=local_user.firebase_uid,
                    email=local_user.email,
                )
                return AuthResponse(
                    access_token=jwt_token,
                    user=UserResponse.model_validate(local_user),
                )

            if settings.auth_mode_normalized == "local":
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid email or password",
                )

        # Firebase-only mode below.
        _ensure_firebase_auth_enabled()

        # 1. Verify password against Firebase Auth REST API
        await verify_password_with_firebase(normalized_email, request.password)

        # 2. Read provider and status from Firebase account
        firebase_user = firebase_auth.get_user_by_email(normalized_email)
        if firebase_user.disabled:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is disabled",
            )

        resolved_provider = choose_primary_auth_provider(
            extract_provider_ids_from_firebase_user(firebase_user),
            PASSWORD_PROVIDER_ID,
        )

        if is_google_provider(resolved_provider):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Google accounts must sign in with Google",
            )

        if not firebase_user.email_verified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email not verified. Check your inbox for the verification link.",
            )

        # 3. Look up the local user record
        user = db.query(User).filter(User.email == normalized_email).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        _ensure_account_active(user)

        if user.password_hash and user.auth_provider == LOCAL_PROVIDER_ID:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This account is configured for local sign-in",
            )

        # 4. Update last login
        _set_user_auth_provider(user, resolved_provider)
        user.last_login = datetime.utcnow()
        db.commit()

        # 5. Issue our API JWT
        jwt_token = _issue_api_jwt(
            user_id=user.id,
            firebase_uid=user.firebase_uid,
            email=user.email,
        )

        return AuthResponse(
            access_token=jwt_token, user=UserResponse.model_validate(user)
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(
            "Login failed with unexpected error", email=request.email, error=str(e)
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Authentication failed: {str(e)}",
        )


@router.post("/register", response_model=AuthResponse)
async def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """Register new user and require immediate Firebase email verification."""
    try:
        normalized_email = request.email.strip().lower()

        # Check if user already exists
        existing_user = db.query(User).filter(User.email == normalized_email).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )

        # Validate username
        username = request.username.strip().lower()
        if len(username) < 3 or len(username) > 30:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username must be 3-30 characters",
            )
        import re

        if not re.match(r"^[a-z0-9_.-]+$", username):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username can only contain lowercase letters, numbers, dots, hyphens, and underscores",
            )
        existing_username = db.query(User).filter(User.username == username).first()
        if existing_username:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken",
            )

        if settings.auth_mode_normalized == "local":
            user = User(
                id=str(uuid.uuid4()),
                firebase_uid=f"{LOCAL_UID_PREFIX}{uuid.uuid4().hex}",
                email=normalized_email,
                username=username,
                display_name=request.display_name,
                auth_provider=LOCAL_PROVIDER_ID,
                password_hash=pwd_context.hash(request.password),
                created_at=datetime.utcnow(),
                last_login=datetime.utcnow(),
            )
            db.add(user)
            db.commit()
            db.refresh(user)

            access_token = _issue_api_jwt(
                user_id=user.id,
                firebase_uid=user.firebase_uid,
                email=user.email,
            )
            return AuthResponse(
                access_token=access_token,
                user=UserResponse.model_validate(user),
                verification_required=False,
            )

        _ensure_firebase_auth_enabled()

        # Create user in Firebase
        firebase_user = firebase_auth.create_user(
            email=normalized_email,
            password=request.password,
            display_name=request.display_name,
        )

        # Create user in our database
        user = User(
            id=str(uuid.uuid4()),
            firebase_uid=firebase_user.uid,
            email=normalized_email,
            username=username,
            display_name=request.display_name,
            auth_provider=PASSWORD_PROVIDER_ID,
            created_at=datetime.utcnow(),
            last_login=None,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        try:
            sign_in = await verify_password_with_firebase(
                normalized_email, request.password
            )
            id_token = sign_in.get("idToken")
            if not id_token:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Could not initialize verification flow",
                )

            await send_firebase_oob_code("VERIFY_EMAIL", id_token=id_token)
        except Exception as verification_error:
            logger.exception(
                "Failed to send verification email after registration",
                email=normalized_email,
                error=str(verification_error),
            )
            # Roll back created account to allow clean retry.
            try:
                db.delete(user)
                db.commit()
            except Exception:
                db.rollback()
            try:
                firebase_auth.delete_user(firebase_user.uid)
            except Exception as firebase_cleanup_error:
                logger.warning(
                    "Failed to cleanup Firebase user after verification failure",
                    email=normalized_email,
                    error=str(firebase_cleanup_error),
                )

            if isinstance(verification_error, HTTPException):
                raise verification_error
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Could not send verification email. Please try again.",
            )

        return AuthResponse(
            access_token=None,
            user=UserResponse.model_validate(user),
            verification_required=True,
            message="Verification email sent. Confirm your email before logging in.",
        )

    except firebase_auth.EmailAlreadyExistsError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(
            "Registration failed with unexpected error",
            email=normalized_email,
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}",
        )


@router.post("/verify-token", response_model=AuthResponse)
async def verify_firebase_token(
    request: FirebaseTokenRequest, db: Session = Depends(get_db)
):
    """Verify Firebase ID token, upsert local user, and return API token."""
    _ensure_firebase_auth_enabled()

    try:
        decoded_token = firebase_auth.verify_id_token(request.firebase_token)
        firebase_uid = decoded_token["uid"]
        email = decoded_token.get("email")
        display_name = request.display_name or decoded_token.get("name", "")

        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Email is required"
            )

        firebase_user = firebase_auth.get_user(firebase_uid)
        if firebase_user.disabled:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is disabled",
            )

        resolved_provider = infer_auth_provider(decoded_token, firebase_user)

        if (
            not is_google_provider(resolved_provider)
            and not firebase_user.email_verified
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email not verified. Check your inbox for the verification link.",
            )

        # Check if user exists in our database
        user = db.query(User).filter(User.firebase_uid == firebase_uid).first()

        if not user:
            user = User(
                id=str(uuid.uuid4()),
                firebase_uid=firebase_uid,
                email=email,
                display_name=display_name,
                auth_provider=resolved_provider,
                created_at=datetime.utcnow(),
                last_login=datetime.utcnow(),
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            _ensure_account_active(user)
            _set_user_auth_provider(user, resolved_provider)
            user.last_login = datetime.utcnow()
            db.commit()

        # Generate JWT token for our API
        access_token = _issue_api_jwt(
            user_id=user.id,
            firebase_uid=user.firebase_uid,
            email=user.email,
        )

        return AuthResponse(
            access_token=access_token,
            user=UserResponse.model_validate(user),
        )

    except firebase_auth.InvalidIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Firebase token"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Firebase token verification failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication failed",
        )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current authenticated user information"""
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_profile(
    request: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update current user's profile information"""
    # Handle username change with validation
    if request.username is not None:
        import re

        username = request.username.strip().lower()
        if len(username) < 3 or len(username) > 30:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username must be 3-30 characters",
            )
        if not re.match(r"^[a-z0-9_.-]+$", username):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username can only contain lowercase letters, numbers, dots, hyphens, and underscores",
            )
        existing = (
            db.query(User)
            .filter(User.username == username, User.id != current_user.id)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken",
            )
        current_user.username = username

    if request.display_name is not None:
        current_user.display_name = request.display_name
    if request.photo_url is not None:
        current_user.photo_url = request.photo_url
    if request.banner_url is not None:
        current_user.banner_url = request.banner_url
    if request.bio is not None:
        current_user.bio = request.bio
    if request.description is not None:
        current_user.description = request.description
    if request.phone is not None:
        current_user.phone = request.phone
    if request.timezone is not None:
        current_user.timezone = request.timezone
    if request.show_projects is not None:
        current_user.show_projects = request.show_projects
    if request.link_x is not None:
        current_user.link_x = request.link_x
    if request.link_discord is not None:
        current_user.link_discord = request.link_discord
    if request.link_bsky is not None:
        current_user.link_bsky = request.link_bsky
    if request.link_linkedin is not None:
        current_user.link_linkedin = request.link_linkedin
    if request.link_website is not None:
        current_user.link_website = request.link_website

    db.commit()
    db.refresh(current_user)
    return current_user


@router.patch("/me/onboarding", response_model=UserResponse)
async def update_onboarding_status(
    has_completed: bool,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update user's onboarding completion status"""
    current_user.has_completed_onboarding = has_completed
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/users/search", response_model=list[UserResponse])
async def search_users(
    query: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Search users by email, display name, or username"""
    if len(query) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Search query must be at least 3 characters",
        )

    users = (
        db.query(User)
        .filter(
            (User.email.ilike(f"%{query}%"))
            | (User.display_name.ilike(f"%{query}%"))
            | (User.username.ilike(f"%{query}%"))
        )
        .limit(10)
        .all()
    )

    return users


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user_profile(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a user's public profile by ID"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return user


@router.get("/username/check")
async def check_username(
    username: str,
    db: Session = Depends(get_db),
):
    """Check if a username is available. Public endpoint (no auth required)."""
    import re

    username = username.strip().lower()
    if len(username) < 3 or len(username) > 30:
        return {"available": False, "reason": "Username must be 3-30 characters"}
    if not re.match(r"^[a-z0-9_.-]+$", username):
        return {
            "available": False,
            "reason": "Only lowercase letters, numbers, dots, hyphens, underscores",
        }
    existing = db.query(User).filter(User.username == username).first()
    return {"available": existing is None}
