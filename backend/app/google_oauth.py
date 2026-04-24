"""Google OAuth helpers for validating ID tokens and extracting identity claims."""

from dataclasses import dataclass
import logging
from typing import Optional

from google.auth.transport import requests
from google.oauth2 import id_token

from app.config import GOOGLE_CLIENT_ID

logger = logging.getLogger(__name__)
VALID_GOOGLE_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}


@dataclass(frozen=True)
class GoogleIdentity:
    """Identity claims needed to map Google login to a local account."""

    email: str
    full_name: Optional[str]


class GoogleTokenValidationError(Exception):
    """Raised when Google token verification fails for login."""

    def __init__(
        self,
        message: str,
        *,
        is_expired: bool = False,
        category: str = "unknown_google_verification_error",
    ):
        super().__init__(message)
        self.is_expired = is_expired
        self.category = category


def verify_google_id_token(token_value: str) -> GoogleIdentity:
    """Verify signature/audience and return normalized identity claims."""
    if not GOOGLE_CLIENT_ID:
        raise GoogleTokenValidationError("Google OAuth is not configured")

    try:
        claims = id_token.verify_oauth2_token(
            token_value,
            requests.Request(),
            GOOGLE_CLIENT_ID,
        )
    except ValueError as exc:
        lowered = str(exc).lower()
        expired = "expired" in lowered
        if "audience" in lowered or "wrong recipient" in lowered:
            category = "invalid_audience"
        elif "issuer" in lowered:
            category = "invalid_issuer"
        elif expired:
            category = "expired_token"
        else:
            category = "unknown_google_verification_error"
        raise GoogleTokenValidationError(
            "Google token has expired" if expired else "Invalid Google token",
            is_expired=expired,
            category=category,
        ) from exc

    audience = str(claims.get("aud", "")).strip()
    if audience != GOOGLE_CLIENT_ID:
        raise GoogleTokenValidationError(
            "Invalid Google token audience",
            category="invalid_audience",
        )

    issuer = str(claims.get("iss", "")).strip()
    if issuer not in VALID_GOOGLE_ISSUERS:
        raise GoogleTokenValidationError(
            "Invalid Google token issuer",
            category="invalid_issuer",
        )

    email = str(claims.get("email", "")).strip().lower()
    if not email:
        raise GoogleTokenValidationError("Google token is missing email")
    if claims.get("email_verified") is not True:
        raise GoogleTokenValidationError("Google email is not verified")

    full_name_claim = claims.get("name")
    full_name = (
        full_name_claim.strip() if isinstance(full_name_claim, str) else None
    )
    if full_name == "":
        full_name = None

    logger.debug(
        "Google token verification success email=%s audience=%s issuer=%s",
        email,
        audience,
        issuer,
    )
    return GoogleIdentity(email=email, full_name=full_name)
