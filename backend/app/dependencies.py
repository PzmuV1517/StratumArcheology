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

        # Get user from database
        user = db.query(User).filter(User.id == user_id).first()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
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

        # Get user from database
        user = db.query(User).filter(User.id == user_id).first()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
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
