import uuid
from datetime import datetime, timedelta

import firebase_admin.auth as firebase_auth
import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
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
        logger.exception("Login failed with unexpected error", email=request.email, error=str(e))
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
        logger.exception("Registration failed with unexpected error", email=request.email, error=str(e))
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
    if request.display_name is not None:
        current_user.display_name = request.display_name
    if request.photo_url is not None:
        current_user.photo_url = request.photo_url
    if request.bio is not None:
        current_user.bio = request.bio

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


@router.get("/users/search")
async def search_users(
    query: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Search users by email or display name"""
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
        )
        .limit(10)
        .all()
    )

    return users
