"""Storage adapters for wardrobe image uploads."""

from __future__ import annotations

from pathlib import Path
from typing import Protocol

from app.config import (
    BACKEND_ROOT,
    S3_ACCESS_KEY_ID,
    S3_BUCKET,
    S3_ENDPOINT_URL,
    S3_PUBLIC_BASE_URL,
    S3_SECRET_ACCESS_KEY,
    STORAGE_BACKEND,
)


LOCAL_UPLOAD_DIR = BACKEND_ROOT / "uploads"


class ImageStorage(Protocol):
    def save(self, filename: str, data: bytes, content_type: str) -> str:
        """Save image bytes and return the URL clients should store."""


class LocalStorage:
    def __init__(self, upload_dir: Path = LOCAL_UPLOAD_DIR) -> None:
        self.upload_dir = upload_dir
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    def save(self, filename: str, data: bytes, content_type: str) -> str:
        destination = self.upload_dir / filename
        destination.write_bytes(data)
        return f"/uploads/{filename}"


class S3Storage:
    def __init__(self) -> None:
        missing = [
            name
            for name, value in {
                "S3_BUCKET": S3_BUCKET,
                "S3_ACCESS_KEY_ID": S3_ACCESS_KEY_ID,
                "S3_SECRET_ACCESS_KEY": S3_SECRET_ACCESS_KEY,
                "S3_PUBLIC_BASE_URL": S3_PUBLIC_BASE_URL,
            }.items()
            if not value
        ]
        if missing:
            raise RuntimeError(f"Missing S3 storage configuration: {', '.join(missing)}")

        import boto3

        self.bucket = S3_BUCKET
        self.public_base_url = S3_PUBLIC_BASE_URL.rstrip("/")
        self.client = boto3.client(
            "s3",
            endpoint_url=S3_ENDPOINT_URL or None,
            aws_access_key_id=S3_ACCESS_KEY_ID,
            aws_secret_access_key=S3_SECRET_ACCESS_KEY,
        )

    def save(self, filename: str, data: bytes, content_type: str) -> str:
        self.client.put_object(
            Bucket=self.bucket,
            Key=filename,
            Body=data,
            ContentType=content_type,
        )
        return f"{self.public_base_url}/{filename}"


_storage: ImageStorage | None = None


def get_storage() -> ImageStorage:
    global _storage
    if _storage is None:
        if STORAGE_BACKEND in {"s3", "r2"}:
            _storage = S3Storage()
        elif STORAGE_BACKEND == "local":
            _storage = LocalStorage()
        else:
            raise RuntimeError(f"Unsupported STORAGE_BACKEND '{STORAGE_BACKEND}'")
    return _storage
