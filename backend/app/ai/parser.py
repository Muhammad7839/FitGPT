"""Strict parsing helpers for AI provider responses."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass


@dataclass(frozen=True)
class ParsedRecommendation:
    """Normalized recommendation payload parsed from AI output."""

    item_ids: list[int]
    explanation: str
    item_explanations: dict[int, str]


_JSON_BLOCK_PATTERN = re.compile(r"\{.*\}", re.DOTALL)


def _extract_json_block(raw_text: str) -> str:
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.startswith("json"):
            cleaned = cleaned[4:].strip()
    if cleaned.startswith("{") and cleaned.endswith("}"):
        return cleaned

    match = _JSON_BLOCK_PATTERN.search(cleaned)
    if match:
        return match.group(0)
    raise ValueError("Missing JSON payload in AI response")


def parse_recommendation_payload(raw_text: str, allowed_item_ids: set[int]) -> ParsedRecommendation:
    """Parse and validate provider output to prevent malformed AI responses."""
    parsed_payload = json.loads(_extract_json_block(raw_text))

    raw_ids = parsed_payload.get("item_ids")
    if not isinstance(raw_ids, list):
        raise ValueError("item_ids must be a list")

    item_ids: list[int] = []
    for raw_id in raw_ids:
        if not isinstance(raw_id, int):
            continue
        if raw_id in allowed_item_ids and raw_id not in item_ids:
            item_ids.append(raw_id)

    if len(item_ids) < 2:
        raise ValueError("item_ids did not include enough valid wardrobe ids")

    explanation = str(parsed_payload.get("explanation", "")).strip()
    if not explanation:
        explanation = "AI selected this outfit based on your wardrobe and preferences."

    parsed_item_explanations: dict[int, str] = {}
    raw_item_explanations = parsed_payload.get("item_explanations")
    if isinstance(raw_item_explanations, dict):
        for raw_key, raw_value in raw_item_explanations.items():
            try:
                item_id = int(raw_key)
            except (TypeError, ValueError):
                continue
            if item_id not in allowed_item_ids:
                continue
            detail = str(raw_value).strip()
            if detail:
                parsed_item_explanations[item_id] = detail

    return ParsedRecommendation(
        item_ids=item_ids,
        explanation=explanation,
        item_explanations=parsed_item_explanations,
    )

