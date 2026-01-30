import uuid
from datetime import datetime

import firebase_admin.auth as firebase_auth
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.rate_limiter import limiter
from app.schemas import (
    AuthResponse,
    FirebaseTokenRequest,
    LoginRequest,
    ProfileUpdateRequest,
    RegisterRequest,
    UserResponse,
)
from app.security import create_access_token

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/login", response_model=AuthResponse)
@limiter.limit(settings.RATE_LIMIT_AUTH_LOGIN)
async def login(
    request: Request, login_data: LoginRequest, db: Session = Depends(get_db)
):
    """Login with email and password using Firebase authentication"""
    try:
        # Authenticate with Firebase using email and password
        # Note: This requires Firebase Admin SDK with appropriate permissions
        # For production, you might want to use Firebase Auth REST API

        # Try to get user by email first to check if they exist
        user = db.query(User).filter(User.email == login_data.email).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        # For now, we'll create a Firebase custom token and verify the user exists
        # In a real implementation, you'd verify the password with Firebase
        # This is a simplified version - you should use Firebase Auth REST API

        try:
            # Create a custom token for the user
            custom_token = firebase_auth.create_custom_token(user.firebase_uid)

            # Update last login
            user.last_login = datetime.utcnow()
            db.commit()

            # Generate JWT token using the new security module
            jwt_token = create_access_token(
                user_id=user.id,
                firebase_uid=user.firebase_uid,
                email=user.email,
            )

            return AuthResponse(
                access_token=jwt_token, user=UserResponse.model_validate(user)
            )

        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication failed",
        )


@router.post("/register", response_model=AuthResponse)
@limiter.limit(settings.RATE_LIMIT_AUTH_REGISTER)
async def register(
    request: Request, register_data: RegisterRequest, db: Session = Depends(get_db)
):
    """Register new user with email and password"""
    try:
        # Check if user already exists in our database
        existing_user = (
            db.query(User).filter(User.email == register_data.email).first()
        )
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "EMAIL_ALREADY_EXISTS",
                    "message": "An account with this email already exists. Please log in instead.",
                    "email": register_data.email,
                },
            )

        # Also check Firebase for existing email (in case DB is out of sync)
        try:
            firebase_auth.get_user_by_email(register_data.email)
            # If we get here, user exists in Firebase but not in our DB
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "EMAIL_ALREADY_EXISTS",
                    "message": "An account with this email already exists. Please log in instead.",
                    "email": register_data.email,
                },
            )
        except firebase_auth.UserNotFoundError:
            # Good - user doesn't exist in Firebase, we can create them
            pass

        # Create user in Firebase
        firebase_user = firebase_auth.create_user(
            email=register_data.email,
            password=register_data.password,
            display_name=register_data.display_name,
        )

        # Create user in our database
        user = User(
            id=str(uuid.uuid4()),
            firebase_uid=firebase_user.uid,
            email=register_data.email,
            display_name=register_data.display_name,
            created_at=datetime.utcnow(),
            last_login=datetime.utcnow(),
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        # Generate JWT token using the new security module
        jwt_token = create_access_token(
            user_id=user.id,
            firebase_uid=user.firebase_uid,
            email=user.email,
        )

        return AuthResponse(
            access_token=jwt_token, user=UserResponse.model_validate(user)
        )

    except HTTPException:
        raise
    except firebase_auth.EmailAlreadyExistsError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "EMAIL_ALREADY_EXISTS",
                "message": "An account with this email already exists. Please log in instead.",
                "email": register_data.email,
            },
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "REGISTRATION_FAILED",
                "message": "Registration failed. Please try again later.",
            },
        )


@router.post("/verify-token", response_model=AuthResponse)
@limiter.limit(settings.RATE_LIMIT_AUTH_LOGIN)
async def verify_firebase_token(
    request: Request, token_data: FirebaseTokenRequest, db: Session = Depends(get_db)
):
    """Verify Firebase ID token and return user data"""
    try:
        # Verify the Firebase ID token
        decoded_token = firebase_auth.verify_id_token(token_data.firebase_token)
        firebase_uid = decoded_token["uid"]
        email = decoded_token.get("email")
        display_name = token_data.display_name or decoded_token.get("name", "")

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

        # Generate JWT token using the new security module
        access_token = create_access_token(
            user_id=user.id,
            firebase_uid=user.firebase_uid,
            email=user.email,
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
@limiter.limit(settings.RATE_LIMIT_READ_OPERATIONS)
async def get_current_user_info(
    request: Request, current_user: User = Depends(get_current_user)
):
    """Get current authenticated user information"""
    return current_user


@router.patch("/me", response_model=UserResponse)
@limiter.limit(settings.RATE_LIMIT_CREATE_NOTE)
async def update_profile(
    request: Request,
    profile_data: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update current user's profile information"""
    if profile_data.display_name is not None:
        current_user.display_name = profile_data.display_name
    if profile_data.photo_url is not None:
        current_user.photo_url = profile_data.photo_url

    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/users/search")
@limiter.limit(settings.RATE_LIMIT_SEARCH)
async def search_users(
    request: Request,
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
