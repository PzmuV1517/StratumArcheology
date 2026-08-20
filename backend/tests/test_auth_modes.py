"""Tests for auth mode behavior (local/firebase/hybrid).

Focuses on local-auth flows introduced for self-hosted deployments:
- Local registration stores a password hash and returns an API JWT.
- Local login works case-insensitively and rejects invalid credentials.
- Firebase token verification endpoint is disabled in local mode.
- Hybrid mode prefers local login for local-password users.
"""

from datetime import datetime
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.routes.auth as auth_routes
from app.config import settings
from app.database import Base, get_db
from app.models import User
from app.routes.auth import router as auth_router


@pytest.fixture(autouse=True)
def mock_password_crypto(monkeypatch: pytest.MonkeyPatch) -> None:
    """Stub password hash/verify so tests focus on auth-mode routing logic."""

    def _hash(secret: str) -> str:
        return f"mock-hash::{secret}"

    def _verify(secret: str, hashed: str) -> bool:
        return hashed == f"mock-hash::{secret}"

    monkeypatch.setattr(auth_routes.pwd_context, "hash", _hash)
    monkeypatch.setattr(auth_routes.pwd_context, "verify", _verify)


@pytest.fixture()
def db_session() -> Session:
    """Create an isolated in-memory SQLite session for auth route tests."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(
        autocommit=False, autoflush=False, bind=engine
    )
    Base.metadata.create_all(bind=engine)

    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture()
def client(db_session: Session) -> TestClient:
    """Build a lightweight app exposing only auth routes with test DB dependency."""
    app = FastAPI()
    app.include_router(auth_router, prefix="/api")

    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db

    with TestClient(app) as test_client:
        yield test_client


def _set_auth_mode(monkeypatch: pytest.MonkeyPatch, mode: str) -> None:
    """Patch runtime auth mode for the duration of a test."""
    monkeypatch.setattr(settings, "AUTH_MODE", mode)


def _create_local_user(db_session: Session, *, email: str, password: str) -> User:
    """Insert a local-auth user directly into the test database."""
    user = User(
        id="user-local-1",
        firebase_uid=f"{auth_routes.LOCAL_UID_PREFIX}abc123",
        email=email,
        username="local_user",
        display_name="Local User",
        auth_provider=auth_routes.LOCAL_PROVIDER_ID,
        password_hash=auth_routes.pwd_context.hash(password),
        created_at=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def test_register_local_mode_creates_password_hash(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _set_auth_mode(monkeypatch, "local")

    response = client.post(
        "/api/auth/register",
        json={
            "email": "LOCAL.USER@example.com",
            "password": "StrongPass123!",
            "display_name": "Local User",
            "username": "local_user",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["verification_required"] is False
    assert isinstance(payload["access_token"], str)
    assert payload["access_token"]
    assert payload["user"]["email"] == "local.user@example.com"
    assert payload["user"]["auth_provider"] == auth_routes.LOCAL_PROVIDER_ID

    created = (
        db_session.query(User).filter(User.email == "local.user@example.com").one()
    )
    assert created.password_hash
    assert created.password_hash != "StrongPass123!"
    assert created.password_hash == "mock-hash::StrongPass123!"
    assert created.firebase_uid.startswith(auth_routes.LOCAL_UID_PREFIX)


def test_login_local_mode_success_and_invalid_credentials(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _set_auth_mode(monkeypatch, "local")
    _create_local_user(
        db_session,
        email="local.login@example.com",
        password="TopSecret123!",
    )

    ok_response = client.post(
        "/api/auth/login",
        json={
            "email": "LOCAL.LOGIN@example.com",
            "password": "TopSecret123!",
        },
    )
    assert ok_response.status_code == 200
    ok_payload = ok_response.json()
    assert ok_payload["user"]["email"] == "local.login@example.com"
    assert ok_payload["user"]["auth_provider"] == auth_routes.LOCAL_PROVIDER_ID
    assert ok_payload["access_token"]

    bad_password = client.post(
        "/api/auth/login",
        json={
            "email": "local.login@example.com",
            "password": "wrong-password",
        },
    )
    assert bad_password.status_code == 401
    assert bad_password.json()["detail"] == "Invalid email or password"

    unknown_user = client.post(
        "/api/auth/login",
        json={
            "email": "unknown@example.com",
            "password": "TopSecret123!",
        },
    )
    assert unknown_user.status_code == 401
    assert unknown_user.json()["detail"] == "Invalid email or password"


def test_verify_token_rejected_when_local_mode_enabled(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _set_auth_mode(monkeypatch, "local")

    response = client.post(
        "/api/auth/verify-token",
        json={"firebase_token": "fake-token"},
    )

    assert response.status_code == 503
    assert "disabled" in response.json()["detail"].lower()


def test_hybrid_mode_prefers_local_login_before_firebase(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _set_auth_mode(monkeypatch, "hybrid")
    _create_local_user(
        db_session,
        email="hybrid.local@example.com",
        password="HybridPass123!",
    )

    async def _fail_if_called(*_args, **_kwargs):
        raise AssertionError("Firebase password flow should not run for local user")

    monkeypatch.setattr(
        auth_routes, "verify_password_with_firebase", _fail_if_called
    )
    monkeypatch.setattr(
        auth_routes.firebase_auth,
        "get_user_by_email",
        lambda _email: SimpleNamespace(
            disabled=False, email_verified=True, provider_data=[]
        ),
    )

    response = client.post(
        "/api/auth/login",
        json={
            "email": "hybrid.local@example.com",
            "password": "HybridPass123!",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["user"]["email"] == "hybrid.local@example.com"
    assert payload["user"]["auth_provider"] == auth_routes.LOCAL_PROVIDER_ID
    assert payload["access_token"]
