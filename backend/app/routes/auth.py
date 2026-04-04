"""
Authentication and user management API routes.

Handles user registration, login (Firebase Auth + JWT), token verification,
profile management, onboarding status, and user search.

MIT License

Copyright (c) 2025 Banu Andrei & Mircea Levin-Constantin

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
"""

import uuid
from datetime import datetime, timedelta

import firebase_admin.auth as firebase_auth
import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

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


async def verify_password_with_firebase(email: str, password: str) -> dict:
    """Verify email/password credentials against Firebase Auth via REST API.

    Returns the Firebase response dict on success.
    Raises HTTPException(401) on invalid credentials.
    """
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


@router.post("/login", response_model=AuthResponse)
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Login with email and password — verified against Firebase Auth."""
    try:
        # Maintainer account is managed from backend env variables.
        if (
            request.email == settings.MAINTAINER_EMAIL
            and request.password == settings.MAINTAINER_PASSWORD
        ):
            maintainer_user = build_maintainer_user()
            jwt_payload = {
                "user_id": "MAINTAINER",
                "firebase_uid": "MAINTAINER",
                "email": settings.MAINTAINER_EMAIL,
                "exp": datetime.utcnow()
                + timedelta(hours=settings.JWT_EXPIRATION_HOURS),
            }
            jwt_token = jwt.encode(
                jwt_payload, settings.JWT_SECRET_KEY, algorithm="HS256"
            )
            return AuthResponse(
                access_token=jwt_token,
                user=UserResponse.model_validate(maintainer_user),
            )

        # 1. Verify password against Firebase Auth REST API
        await verify_password_with_firebase(request.email, request.password)

        # 2. Look up the local user record
        user = db.query(User).filter(User.email == request.email).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        # 3. Update last login
        user.last_login = datetime.utcnow()
        db.commit()

        # 4. Issue our API JWT
        jwt_payload = {
            "user_id": user.id,
            "firebase_uid": user.firebase_uid,
            "email": user.email,
            "exp": datetime.utcnow()
            + timedelta(hours=settings.JWT_EXPIRATION_HOURS),
        }

        jwt_token = jwt.encode(
            jwt_payload, settings.JWT_SECRET_KEY, algorithm="HS256"
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
    """Register new user with email and password"""
    try:
        # Check if user already exists
        existing_user = db.query(User).filter(User.email == request.email).first()
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

        # Create user in Firebase
        firebase_user = firebase_auth.create_user(
            email=request.email,
            password=request.password,
            display_name=request.display_name,
        )

        # Create user in our database
        user = User(
            id=str(uuid.uuid4()),
            firebase_uid=firebase_user.uid,
            email=request.email,
            username=username,
            display_name=request.display_name,
            created_at=datetime.utcnow(),
            last_login=datetime.utcnow(),
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        # Generate JWT token for our API
        jwt_payload = {
            "user_id": user.id,
            "firebase_uid": user.firebase_uid,
            "email": user.email,
            "exp": datetime.utcnow()
            + timedelta(hours=settings.JWT_EXPIRATION_HOURS),
        }

        jwt_token = jwt.encode(
            jwt_payload, settings.JWT_SECRET_KEY, algorithm="HS256"
        )

        return AuthResponse(
            access_token=jwt_token, user=UserResponse.model_validate(user)
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
            email=request.email,
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
    """Verify Firebase ID token and return user data"""
    try:
        # Verify the Firebase ID token
        decoded_token = firebase_auth.verify_id_token(request.firebase_token)
        firebase_uid = decoded_token["uid"]
        email = decoded_token.get("email")
        display_name = request.display_name or decoded_token.get("name", "")

        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Email is required"
            )

        # Check if user exists in our database
        user = db.query(User).filter(User.firebase_uid == firebase_uid).first()

        if not user:
            # Create new user
            user = User(
                id=str(uuid.uuid4()),
                firebase_uid=firebase_uid,
                email=email,
                display_name=display_name,
                created_at=datetime.utcnow(),
                last_login=datetime.utcnow(),
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            # Update last login
            user.last_login = datetime.utcnow()
            db.commit()

        # Generate JWT token for our API
        jwt_payload = {
            "user_id": user.id,
            "firebase_uid": user.firebase_uid,
            "email": user.email,
            "exp": datetime.utcnow().timestamp() + (24 * 60 * 60),  # 24 hours
        }

        access_token = jwt.encode(
            jwt_payload, settings.JWT_SECRET_KEY, algorithm="HS256"
        )

        return AuthResponse(access_token=access_token, user=user)

    except firebase_auth.InvalidIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Firebase token"
        )
    except Exception as e:
        print(f"Auth error: {e}")  # For debugging
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
