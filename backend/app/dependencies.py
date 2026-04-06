"""
FastAPI dependency functions for auth and permissions. Handles JWT
token verification and project-level access control.

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

from datetime import datetime

import jwt
from fastapi import Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User

security = HTTPBearer(
    auto_error=False
)  # Allow None for endpoints with optional auth


def _maintainer_email_matches_payload(payload: dict) -> bool:
    """Check whether the JWT payload email still matches current env maintainer."""
    token_email = str(payload.get("email") or "").strip().lower()
    expected_email = settings.MAINTAINER_EMAIL.strip().lower()
    return bool(token_email and token_email == expected_email)


def build_maintainer_user() -> User:
    """Build an in-memory maintainer user object from env credentials."""
    maintainer_user = User(
        id="MAINTAINER",
        firebase_uid="MAINTAINER",
        email=settings.MAINTAINER_EMAIL,
        username="maintainer",
        display_name="System Maintainer",
        show_projects=True,
        photo_url=None,
        banner_url=None,
        bio=None,
        description=None,
        phone=None,
        timezone=None,
        link_x=None,
        link_discord=None,
        link_bsky=None,
        link_linkedin=None,
        link_website=None,
        auth_provider="maintainer",
        is_emonument_privileged=True,
        is_dashboard_admin=True,
        is_account_disabled=False,
        is_soft_deleted=False,
        soft_deleted_at=None,
        has_completed_onboarding=True,
        created_at=datetime.utcnow(),
        last_login=datetime.utcnow(),
    )
    maintainer_user.is_maintainer = True
    return maintainer_user


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """Dependency to get the current authenticated user"""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = credentials.credentials

    try:
        # Verify our JWT token
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("user_id")

        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Allow maintainer bypass
        if user_id == "MAINTAINER":
            if not _maintainer_email_matches_payload(payload):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Maintainer token no longer matches current configuration",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            return build_maintainer_user()

        # Get user from database
        user = db.query(User).filter(User.id == user_id).first()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
            )

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

        return user

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user_or_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    token: str | None = Query(
        None,
        description="JWT token as query parameter (alternative to Authorization header)",
    ),
    db: Session = Depends(get_db),
) -> User:
    """
    Dependency to get the current authenticated user.
    Accepts token from either Authorization header OR query parameter.
    Useful for downloads and streaming where headers can't be easily set.
    """
    # Get token from header or query param
    jwt_token = None
    if credentials:
        jwt_token = credentials.credentials
    elif token:
        jwt_token = token

    if not jwt_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated - provide Authorization header or token query param",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        # Verify our JWT token
        payload = jwt.decode(
            jwt_token, settings.JWT_SECRET_KEY, algorithms=["HS256"]
        )
        user_id = payload.get("user_id")

        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Allow maintainer bypass
        if user_id == "MAINTAINER":
            if not _maintainer_email_matches_payload(payload):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Maintainer token no longer matches current configuration",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            return build_maintainer_user()

        # Get user from database
        user = db.query(User).filter(User.id == user_id).first()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
            )

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

        return user

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def check_project_permission(
    project_id: str, user: User, db: Session, required_role: str = None
) -> bool:
    """Check if user has permission to access a project"""
    if getattr(user, "is_maintainer", False):
        return True

    from sqlalchemy import select

    from app.models import Project, project_members

    project = db.query(Project).filter(Project.id == project_id).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )

    # Owner has all permissions
    if project.owner_id == user.id:
        return True

    # Check if user is a member
    stmt = select(project_members).where(
        project_members.c.project_id == project_id,
        project_members.c.user_id == user.id,
    )
    result = db.execute(stmt).first()

    if not result:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this project",
        )

    # If specific role is required, check it
    if required_role:
        user_role = result.role
        role_hierarchy = {"leader": 3, "researcher": 2, "guest": 1}

        if role_hierarchy.get(user_role.value, 0) < role_hierarchy.get(
            required_role, 0
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires {required_role} role or higher",
            )

    return True
