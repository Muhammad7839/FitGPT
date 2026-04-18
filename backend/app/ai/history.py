"""Persistent repeat-prevention history for recommendation fingerprints."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app import models

DEFAULT_HISTORY_LIMIT = 10


def get_recent_fingerprints(db: Session, user_id: int, limit: int = DEFAULT_HISTORY_LIMIT) -> list[str]:
    """Return most recent recommendation fingerprints for a user."""
    rows = (
        db.query(models.RecommendationFingerprint)
        .filter(models.RecommendationFingerprint.owner_id == user_id)
        .order_by(models.RecommendationFingerprint.created_at_timestamp.desc())
        .limit(limit)
        .all()
    )
    return [row.fingerprint for row in rows if row.fingerprint]


def save_fingerprint(
    db: Session,
    user_id: int,
    fingerprint: str,
    limit: int = DEFAULT_HISTORY_LIMIT,
) -> None:
    """Stores a fingerprint and prunes older entries for bounded growth."""
    if not fingerprint:
        return

    db.query(models.RecommendationFingerprint).filter(
        models.RecommendationFingerprint.owner_id == user_id,
        models.RecommendationFingerprint.fingerprint == fingerprint,
    ).delete()

    row = models.RecommendationFingerprint(
        owner_id=user_id,
        fingerprint=fingerprint,
        created_at_timestamp=int(datetime.now(timezone.utc).timestamp()),
    )
    db.add(row)
    db.commit()

    ids_to_keep = [
        entry.id
        for entry in (
            db.query(models.RecommendationFingerprint.id)
            .filter(models.RecommendationFingerprint.owner_id == user_id)
            .order_by(models.RecommendationFingerprint.created_at_timestamp.desc())
            .limit(limit)
            .all()
        )
    ]
    if ids_to_keep:
        db.query(models.RecommendationFingerprint).filter(
            models.RecommendationFingerprint.owner_id == user_id,
            models.RecommendationFingerprint.id.notin_(ids_to_keep),
        ).delete(synchronize_session=False)
        db.commit()
