"""
MinIO (S3-compatible) storage client. Wraps uploads, downloads,
deletes, and presigned URL generation for the STRATUM file storage.

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

from contextvars import ContextVar
from io import BytesIO
from typing import Optional
from urllib.parse import quote

from minio import Minio
from minio.error import S3Error

from app.config import settings

# Stores the base URL of the current request (set by middleware) so that
# presigned helpers can return proxy URLs reachable from any device.
_request_base_url: ContextVar[str | None] = ContextVar(
    "_request_base_url", default=None
)


def set_request_base_url(url: str) -> None:
    """Called by middleware to capture the incoming request's base URL."""
    _request_base_url.set(url)


class MinIOClient:
    """Wrapper around the Minio Python client for STRATUM's file storage."""

    def __init__(self):
        """Set up the MinIO connection and make sure our bucket exists."""
        try:
            self.client = Minio(
                settings.MINIO_ENDPOINT,
                access_key=settings.MINIO_ACCESS_KEY,
                secret_key=settings.MINIO_SECRET_KEY,
                secure=settings.MINIO_USE_SSL,
            )
            self.bucket_name = settings.MINIO_BUCKET_NAME
            self.available = True
        except Exception as e:
            print(f"✗ MinIO init error: {e}")
            self.client = None
            self.bucket_name = settings.MINIO_BUCKET_NAME
            self.available = False
            return

        try:
            self._ensure_bucket_exists()
        except Exception as e:
            print(f"✗ MinIO bucket ensure failed: {e}")
            self.available = False

    def _ensure_bucket_exists(self):
        """Create bucket if it doesn't exist"""
        if not self.client:
            raise RuntimeError("MinIO client is not initialized")

        try:
            if not self.client.bucket_exists(self.bucket_name):
                self.client.make_bucket(self.bucket_name)
                print(f"✓ MinIO bucket '{self.bucket_name}' created")
            else:
                print(f"✓ MinIO bucket '{self.bucket_name}' exists")
        except S3Error as e:
            print(f"✗ MinIO bucket error: {e}")
            raise

    def is_available(self) -> bool:
        """Return True when MinIO client is initialized and reachable."""
        if not self.client or not self.available:
            return False

        try:
            self.client.bucket_exists(self.bucket_name)
            self.available = True
            return True
        except Exception:
            self.available = False
            return False

    async def upload_file(
        self,
        file_data: bytes,
        object_name: str,
        content_type: str = "application/octet-stream",
    ) -> str:
        """Upload file to MinIO"""
        if not self.client:
            raise RuntimeError("MinIO client unavailable")

        try:
            file_stream = BytesIO(file_data)
            self.client.put_object(
                self.bucket_name,
                object_name,
                file_stream,
                length=len(file_data),
                content_type=content_type,
            )
            return object_name
        except S3Error as e:
            print(f"✗ File upload error: {e}")
            raise

    async def get_file(self, object_name: str) -> Optional[bytes]:
        """Get file from MinIO"""
        if not self.client:
            return None

        try:
            response = self.client.get_object(self.bucket_name, object_name)
            data = response.read()
            response.close()
            response.release_conn()
            return data
        except S3Error as e:
            print(f"✗ File retrieval error: {e}")
            return None

    async def delete_file(self, object_name: str) -> bool:
        """Delete file from MinIO"""
        if not self.client:
            return False

        try:
            self.client.remove_object(self.bucket_name, object_name)
            return True
        except S3Error as e:
            print(f"✗ File deletion error: {e}")
            return False

    def get_presigned_url(self, object_name: str, expiry: int = 3600) -> str:
        """Get a URL for file access.

        When a request context is available (set by middleware), returns a
        proxy URL that routes through the API server so mobile / remote
        clients can reach the file.  Falls back to a direct MinIO presigned
        URL for CLI / script usage.
        """
        base_url = _request_base_url.get()
        if base_url:
            return (
                f"{base_url}api/files/storage/"
                f"{quote(self.bucket_name, safe='')}"
                f"/{quote(object_name, safe='/')}"
            )

        if not self.client:
            raise RuntimeError("MinIO client unavailable")

        try:
            from datetime import timedelta

            url = self.client.presigned_get_object(
                self.bucket_name, object_name, expires=timedelta(seconds=expiry)
            )
            return url
        except S3Error as e:
            print(f"✗ Presigned URL error: {e}")
            raise

    def ensure_bucket(self, bucket_name: str) -> None:
        """Ensure a named bucket exists (creates it if missing)."""
        if not self.client:
            return
        try:
            if not self.client.bucket_exists(bucket_name):
                self.client.make_bucket(bucket_name)
                print(f"✓ MinIO bucket '{bucket_name}' created")
            else:
                print(f"✓ MinIO bucket '{bucket_name}' exists")
        except S3Error as e:
            print(f"✗ MinIO bucket ensure error ({bucket_name}): {e}")

    def upload_text(
        self, bucket: str, key: str, text: str, content_type: str = "image/svg+xml"
    ) -> str:
        """Upload a UTF-8 text payload to MinIO and return the object key."""
        if not self.client:
            raise RuntimeError("MinIO client unavailable")
        data = text.encode("utf-8")
        stream = BytesIO(data)
        try:
            self.client.put_object(
                bucket, key, stream, length=len(data), content_type=content_type
            )
            return key
        except S3Error as e:
            print(f"✗ MinIO upload_text error: {e}")
            raise

    def get_presigned_url_for_bucket(
        self, bucket: str, key: str, expiry_seconds: int = 604800
    ) -> str:
        """Return a URL for an object in *any* bucket.

        Uses a proxy URL when a request context is available; falls back to
        a direct MinIO presigned URL otherwise.
        """
        base_url = _request_base_url.get()
        if base_url:
            return (
                f"{base_url}api/files/storage/"
                f"{quote(bucket, safe='')}"
                f"/{quote(key, safe='/')}"
            )

        if not self.client:
            raise RuntimeError("MinIO client unavailable")
        from datetime import timedelta

        try:
            return self.client.presigned_get_object(
                bucket, key, expires=timedelta(seconds=expiry_seconds)
            )
        except S3Error as e:
            print(f"✗ MinIO presigned URL error: {e}")
            raise


# Initialize MinIO client
minio_client = MinIOClient()


def resolve_storage_url(url: str | None) -> str | None:
    """If *url* looks like a MinIO object path, generate a fresh presigned URL.

    Recognises paths stored by the profile-picture / banner-image upload
    endpoints (e.g. ``profiles/…`` or ``banners/…``).  Full HTTP(S) or
    data-URIs are passed through unchanged.
    """
    if not url:
        return None
    # Already a full URL – nothing to resolve
    if url.startswith(("http://", "https://", "data:")):
        return url
    # Treat as a MinIO object key → generate a 1-hour presigned URL
    try:
        return minio_client.get_presigned_url(url, expiry=3600)
    except Exception:
        return url
