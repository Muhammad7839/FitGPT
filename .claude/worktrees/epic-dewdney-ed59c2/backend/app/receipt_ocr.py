"""Extract clothing line items from a receipt photo via a vision-capable LLM."""

from __future__ import annotations

import base64
import json
import logging
from dataclasses import dataclass, field
from typing import Optional

from app.config import GROQ_API_KEY, GROQ_VISION_MODEL

logger = logging.getLogger(__name__)

_VALID_CATEGORIES = {"Top", "Bottom", "Outerwear", "Shoes", "Accessory"}
_VALID_MIME = {"image/jpeg", "image/png", "image/webp"}
_MAX_ITEMS = 50

_PROMPT = (
    "You are a receipt parser. Extract ONLY clothing line items from the receipt image.\n\n"
    "PRIVACY (critical): NEVER include card numbers, card tails, account numbers, "
    "names, addresses, phone numbers, or email addresses in your response.\n\n"
    "Return valid JSON only, no markdown:\n"
    '{"items": [{"name": "Black Cotton Tee", "category": "Top", "color": "Black", "price": 24.99}]}\n\n'
    "Category must be exactly one of: Top, Bottom, Outerwear, Shoes, Accessory.\n"
    "Skip non-clothing lines (food, gift cards, services, taxes, shipping, subtotals).\n\n"
    "If color codes appear in the description (BLK, NAVY, WHT), expand to full names "
    "(Black, Navy, White). If no color is visible, use an empty string and do not guess.\n\n"
    "Price is the numeric per-item price, or 0 if unclear. Never include currency symbols. "
    'If the image is not a clothing receipt, return {"items": []}.'
)


@dataclass
class ReceiptItem:
    name: str
    category: str
    color: str = ""
    price: float = 0.0


@dataclass
class ReceiptExtractionResult:
    items: list[ReceiptItem] = field(default_factory=list)
    source: str = "unknown"
    warning: Optional[str] = None


def _get_vision_client():
    api_key = (GROQ_API_KEY or "").strip()
    if not api_key:
        return None
    if not (GROQ_VISION_MODEL or "").strip():
        logger.warning("GROQ_VISION_MODEL is unset; receipt OCR disabled")
        return None
    try:
        from groq import Groq

        return Groq(api_key=api_key)
    except Exception as exc:  # noqa: BLE001
        logger.error("Failed to initialize Groq vision client: %s", exc)
        return None


def _normalize_item(entry: object) -> Optional[ReceiptItem]:
    if not isinstance(entry, dict):
        return None
    name = str(entry.get("name", "") or "").strip()
    category = str(entry.get("category", "") or "").strip().title()
    if category == "Accessories":
        category = "Accessory"
    if not name or category not in _VALID_CATEGORIES:
        return None
    color = str(entry.get("color", "") or "").strip()
    try:
        price_raw = entry.get("price", 0)
        price = float(price_raw) if price_raw not in (None, "") else 0.0
    except (TypeError, ValueError):
        price = 0.0
    return ReceiptItem(
        name=name[:128],
        category=category,
        color=color[:64],
        price=max(0.0, price),
    )


def extract_clothing_items(image_bytes: bytes, content_type: str) -> ReceiptExtractionResult:
    """Extract clothing line items from a receipt image without raising."""
    if not image_bytes:
        return ReceiptExtractionResult(source="empty", warning="empty_image")

    mime = (content_type or "").split(";", 1)[0].strip().lower()
    if mime not in _VALID_MIME:
        return ReceiptExtractionResult(source="empty", warning="unsupported_mime")

    client = _get_vision_client()
    if client is None:
        return ReceiptExtractionResult(source="unavailable", warning="provider_not_configured")

    encoded = base64.b64encode(image_bytes).decode("ascii")
    data_url = f"data:{mime};base64,{encoded}"

    try:
        response = client.chat.completions.create(
            model=GROQ_VISION_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": _PROMPT},
                        {"type": "image_url", "image_url": {"url": data_url}},
                    ],
                }
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
            max_tokens=1024,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Groq vision call failed: %s", exc)
        return ReceiptExtractionResult(source="error", warning="provider_error")

    raw = (response.choices[0].message.content or "{}").strip()
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        logger.info("Groq vision returned malformed JSON for receipt OCR")
        return ReceiptExtractionResult(source="error", warning="malformed_response")

    raw_items = parsed.get("items", [])
    if not isinstance(raw_items, list):
        return ReceiptExtractionResult(source="error", warning="malformed_response")

    items: list[ReceiptItem] = []
    for entry in raw_items:
        normalized = _normalize_item(entry)
        if normalized is not None:
            items.append(normalized)
        if len(items) >= _MAX_ITEMS:
            break

    return ReceiptExtractionResult(items=items, source="ai" if items else "empty")
