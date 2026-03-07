"""Google OAuth helpers for verifying ID tokens and extracting profile claims."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from google.auth.transport import requests
from google.oauth2 import id_token

from app.config import GOOGLE_CLIENT_ID


@dataclass(frozen=True)
class GoogleIdentity:
    """Minimal user identity parsed from a verified Google token."""

    email: str
    full_name: Optional[str]


class GoogleTokenValidationError(Exception):
    """Raised when a Google ID token is invalid for login."""

    def __init__(self, message: str, *, is_expired: bool = False):
        super().__init__(message)
        self.is_expired = is_expired


def verify_google_id_token(token_value: str) -> GoogleIdentity:
    """Validate Google ID token signature/audience and return identity claims."""
    if not GOOGLE_CLIENT_ID:
        raise GoogleTokenValidationError("Google OAuth is not configured")

    try:
        claims = id_token.verify_oauth2_token(
            token_value,
            requests.Request(),
            GOOGLE_CLIENT_ID,
        )
    except ValueError as exc:
        message = str(exc).lower()
        raise GoogleTokenValidationError(
            "Google token has expired" if "expired" in message else "Invalid Google token",
            is_expired="expired" in message,
        ) from exc

    email = str(claims.get("email", "")).strip().lower()
    if not email:
        raise GoogleTokenValidationError("Google token is missing email")
    if claims.get("email_verified") is False:
        raise GoogleTokenValidationError("Google email is not verified")

    full_name = claims.get("name")
    if isinstance(full_name, str):
        full_name = full_name.strip() or None
    else:
        full_name = None

    return GoogleIdentity(email=email, full_name=full_name)
