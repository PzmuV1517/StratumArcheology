"""
Tests for pointcloud converter route security behavior.

Covers the security hardening contract:
- Converter endpoints require authentication.
- Remote URL conversion via GET is disabled.
- Upload endpoint remains reachable for authenticated callers.

Run with: pytest backend/tests/test_convert_routes.py -v
"""

from collections.abc import Generator
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.database import get_db
from app.dependencies import get_current_user
from app.routes.convert import router as convert_router


def _override_get_db() -> Generator[object]:
    """Provide a dummy DB dependency for auth checks in tests."""
    yield object()


def _override_get_current_user() -> SimpleNamespace:
    """Provide a lightweight authenticated user object for route tests."""
    return SimpleNamespace(id="test-user")


def _build_app(authenticated: bool = False) -> FastAPI:
    """Build an isolated FastAPI app with only converter routes."""
    app = FastAPI()
    app.include_router(convert_router, prefix="/api")
    app.dependency_overrides[get_db] = _override_get_db

    if authenticated:
        app.dependency_overrides[get_current_user] = _override_get_current_user

    return app


def test_convert_pointcloud_get_requires_auth() -> None:
    app = _build_app(authenticated=False)

    with TestClient(app) as client:
        response = client.get(
            "/api/convert/pointcloud",
            params={"src": "https://example.com/model.las"},
        )

    assert response.status_code == 401


def test_convert_pointcloud_post_requires_auth() -> None:
    app = _build_app(authenticated=False)

    with TestClient(app) as client:
        response = client.post(
            "/api/convert/pointcloud",
            files={"file": ("sample.las", b"123", "application/octet-stream")},
        )

    assert response.status_code == 401


def test_convert_pointcloud_get_remote_mode_disabled_for_authenticated_user() -> (
    None
):
    app = _build_app(authenticated=True)

    with TestClient(app) as client:
        response = client.get(
            "/api/convert/pointcloud",
            params={"src": "https://example.com/model.las"},
        )

    assert response.status_code == 403
    detail = response.json().get("detail", "")
    assert "remote url conversion is disabled" in detail.lower()


def test_convert_pointcloud_post_still_reachable_for_authenticated_user() -> None:
    app = _build_app(authenticated=True)

    with TestClient(app) as client:
        response = client.post(
            "/api/convert/pointcloud",
            files={"file": ("empty.las", b"", "application/octet-stream")},
        )

    assert response.status_code == 400
    assert response.json().get("detail") == "Empty upload"
