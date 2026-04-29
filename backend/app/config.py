"""
App settings loaded from .env via pydantic-settings. All the env vars
for Firebase, Postgres, MinIO, JWT, and general app config live here.

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

import os
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """All configuration for the app, pulled from environment variables."""

    # Auth + Deployment mode
    AUTH_MODE: Literal["firebase", "local", "hybrid"] = "firebase"
    DEPLOYMENT_MODE: Literal["cloud", "self_hosted"] = "cloud"
    SELF_HOST_BUNDLE: bool = False

    # Firebase
    FIREBASE_WEB_API_KEY: str | None = None
    FIREBASE_PROJECT_ID: str | None = None
    FIREBASE_PRIVATE_KEY_ID: str | None = None
    FIREBASE_PRIVATE_KEY: str | None = None
    FIREBASE_CLIENT_EMAIL: str | None = None
    FIREBASE_CLIENT_ID: str | None = None
    FIREBASE_AUTH_URI: str | None = "https://accounts.google.com/o/oauth2/auth"
    FIREBASE_TOKEN_URI: str | None = "https://oauth2.googleapis.com/token"
    FIREBASE_AUTH_PROVIDER_CERT_URL: str = (
        "https://www.googleapis.com/oauth2/v1/certs"
    )
    FIREBASE_CLIENT_CERT_URL: str | None = None

    # PostgreSQL
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    DATABASE_URL: str

    # MinIO
    MINIO_ENDPOINT: str
    MINIO_ACCESS_KEY: str
    MINIO_SECRET_KEY: str
    MINIO_BUCKET_NAME: str = "stratum-files"
    MINIO_USE_SSL: bool = False

    # Dashboard Maintainer
    MAINTAINER_EMAIL: str
    MAINTAINER_PASSWORD: str

    # Backup System
    BACKUP_BUCKET_NAME: str = "stratum-db-backups"
    BACKUP_INTERVAL_MINUTES: int = 60
    BACKUP_RETENTION_COUNT: int = 5
    BACKUP_AUTO_START: bool = True
    BACKUP_PGDUMP_BIN: str = "pg_dump"
    BACKUP_PSQL_BIN: str = "psql"
    BACKUP_DATABASES: str = ""

    # App
    APP_SECRET_KEY: str
    APP_DEBUG: bool = True
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    ALLOWED_ORIGINS: str

    # JWT
    JWT_SECRET_KEY: str
    JWT_EXPIRATION_HOURS: int = 24

    # Environment
    ENVIRONMENT: str = "development"

    # AI Summary
    AI_SUMMARY_CHANGE_THRESHOLD: int = 15  # activities since last summary before refresh is offered

    # Transcription (local Whisper)
    DISABLE_WHISPER: bool = False  # set True to skip model load and transcription entirely
    WHISPER_MODEL: str = "base"  # tiny | base | small | medium | large

    # Rate Limiting
    RATE_LIMIT_DEFAULT: str = "100 per minute"

    @property
    def auth_mode_normalized(self) -> str:
        """Return auth mode as a normalized lower-case token."""
        return self.AUTH_MODE.strip().lower()

    @property
    def firebase_auth_enabled(self) -> bool:
        """Whether Firebase-backed authentication is enabled."""
        return self.auth_mode_normalized in {"firebase", "hybrid"}

    @property
    def local_auth_enabled(self) -> bool:
        """Whether local email/password authentication is enabled."""
        return self.auth_mode_normalized in {"local", "hybrid"}

    @property
    def google_auth_enabled(self) -> bool:
        """Google sign-in is available only when Firebase auth is enabled."""
        return self.firebase_auth_enabled

    @property
    def deployment_mode_normalized(self) -> str:
        """Return effective deployment mode considering bundle flag."""
        if self.SELF_HOST_BUNDLE:
            return "self_hosted"
        return self.DEPLOYMENT_MODE.strip().lower()

    @model_validator(mode="after")
    def validate_firebase_requirements(self) -> "Settings":
        """Require Firebase secrets only when Firebase auth is enabled."""
        if not self.firebase_auth_enabled:
            return self

        required = [
            "FIREBASE_WEB_API_KEY",
            "FIREBASE_PROJECT_ID",
            "FIREBASE_PRIVATE_KEY_ID",
            "FIREBASE_PRIVATE_KEY",
            "FIREBASE_CLIENT_EMAIL",
            "FIREBASE_CLIENT_ID",
            "FIREBASE_AUTH_URI",
            "FIREBASE_TOKEN_URI",
            "FIREBASE_AUTH_PROVIDER_CERT_URL",
            "FIREBASE_CLIENT_CERT_URL",
        ]
        missing = [field for field in required if not getattr(self, field)]
        if missing:
            missing_csv = ", ".join(missing)
            raise ValueError(
                "Missing Firebase configuration for AUTH_MODE="
                f"{self.auth_mode_normalized}: {missing_csv}"
            )

        return self

    @property
    def allowed_origins_list(self) -> list[str]:
        """Split the comma-separated ALLOWED_ORIGINS string into a list."""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]

    class Config:
        """Pydantic-settings inner config for env file location."""

        env_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
        case_sensitive = True
        # Allow unknown env vars (e.g. STRATUMAI_APIKEY_N / STRATUMAI_PROVIDER_N)
        extra = "ignore"


settings = Settings()
