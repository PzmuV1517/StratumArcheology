import os

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Firebase
    FIREBASE_PROJECT_ID: str
    FIREBASE_PRIVATE_KEY_ID: str
    FIREBASE_PRIVATE_KEY: str
    FIREBASE_CLIENT_EMAIL: str
    FIREBASE_CLIENT_ID: str
    FIREBASE_AUTH_URI: str = "https://accounts.google.com/o/oauth2/auth"
    FIREBASE_TOKEN_URI: str = "https://oauth2.googleapis.com/token"
    FIREBASE_AUTH_PROVIDER_CERT_URL: str = (
        "https://www.googleapis.com/oauth2/v1/certs"
    )
    FIREBASE_CLIENT_CERT_URL: str

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

    # Rate Limiting
    RATE_LIMIT_DEFAULT: str = "100 per minute"
    
    # Strict limits for sensitive operations
    RATE_LIMIT_AUTH_LOGIN: str = "5 per minute"
    RATE_LIMIT_AUTH_REGISTER: str = "3 per minute"
    RATE_LIMIT_PASSWORD_RESET: str = "3 per minute"
    
    # Moderate limits for write operations
    RATE_LIMIT_CREATE_PROJECT: str = "10 per minute"
    RATE_LIMIT_CREATE_NOTE: str = "30 per minute"
    RATE_LIMIT_FILE_UPLOAD: str = "20 per minute"
    RATE_LIMIT_INVITE_CREATE: str = "10 per minute"
    RATE_LIMIT_WRITE: str = "30 per minute"  # General write operations
    RATE_LIMIT_UPLOAD: str = "20 per minute"  # File uploads
    RATE_LIMIT_INVITES: str = "10 per minute"  # Invite operations
    
    # Relaxed limits for read operations
    RATE_LIMIT_READ: str = "200 per minute"  # General read operations
    RATE_LIMIT_READ_OPERATIONS: str = "200 per minute"
    RATE_LIMIT_LIST_OPERATIONS: str = "100 per minute"
    RATE_LIMIT_SEARCH: str = "60 per minute"
    
    # Special limits
    RATE_LIMIT_HEALTH_CHECK: str = "1000 per minute"
    RATE_LIMIT_WEBSOCKET: str = "30 per minute"
    RATE_LIMIT_FILE_DOWNLOAD: str = "100 per minute"
    RATE_LIMIT_CONVERT: str = "10 per minute"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]

    class Config:
        env_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
        case_sensitive = True


settings = Settings()
