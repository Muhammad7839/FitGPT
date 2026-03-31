import os
import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)

_client = None


def _get_client():
    global _client
    if _client is not None:
        return _client

    api_key = os.environ.get("GROQ_API_KEY", "").strip()
    if not api_key or api_key == "your_groq_api_key_here":
        logger.warning("GROQ_API_KEY not set or is placeholder — AI recommendations disabled")
        return None

    try:
        from groq import Groq
        _client = Groq(api_key=api_key)
        return _client
    except Exception as e:
        logger.error("Failed to initialize Groq client: %s", e)
        return None


def build_system_prompt() -> str:
    return (
        "You are a professional fashion stylist AI. "
        "Given a list of wardrobe items with their IDs, categories, colors, fit types, style tags, "
        "and layer types, create exactly 3 outfit combinations.\n\n"
        "Rules:\n"
        "- ONLY use item IDs from the provided list. Never invent IDs.\n"
        "- Each outfit MUST include one item from EVERY category present in the wardrobe "
        "(top, bottom, shoes, outerwear, accessory). If the wardrobe has items in 5 categories, "
        "each outfit should have 5 items — one per category.\n"
        "- Never skip a category that has items available.\n"
        "- Each outfit must have AT MOST one item per category (one top, one bottom, one shoes, etc.). "
        "Never include two tops or two bottoms in the same outfit.\n"
        "- Consider the provided context: weather, time of day, body type, occasion, and style preferences.\n"
        "- Ensure color harmony — neutrals pair with everything, avoid clashing warm+cool.\n"
        "- Each outfit should be distinct from the others.\n"
        "- Provide a brief 1-2 sentence explanation for each outfit.\n\n"
        "LAYERING RULES (critical for realism):\n"
        "- Items have a layer_type: 'base' (t-shirts, polos), 'mid' (sweaters, hoodies), or 'outer' (jackets, coats).\n"
        "- For COLD weather: build 3 layers — a base top + a mid-layer (sweater/hoodie) + an outer layer (coat/jacket). "
        "All 3 layers are strongly preferred.\n"
        "- For COOL weather: build 2 layers — a base top + an outer layer (jacket/blazer). A mid-layer is optional.\n"
        "- For MILD weather: a base top is sufficient. A light jacket is optional.\n"
        "- For WARM/HOT weather: use only lightweight base items. Do NOT include outerwear, heavy sweaters, or coats.\n"
        "- Never pair a tank top or camisole directly with a heavy coat/parka — a mid-layer must be between them.\n"
        "- Never include two mid-layers or two outer layers in the same outfit.\n\n"
        "Respond with valid JSON only, no markdown, no extra text. Use this exact format:\n"
        '{"outfits": [\n'
        '  {"item_ids": ["id1", "id2", "id3"], "explanation": "Why this outfit works."},\n'
        '  {"item_ids": ["id4", "id5", "id6"], "explanation": "Why this outfit works."},\n'
        '  {"item_ids": ["id7", "id8", "id9"], "explanation": "Why this outfit works."}\n'
        "]}"
    )


def build_user_prompt(items: list, context: dict) -> str:
    serialized_items = []
    for item in items:
        entry = {
            "id": str(item.get("id", "")),
            "name": item.get("name", ""),
            "category": item.get("category", ""),
            "color": item.get("color", ""),
            "fit_type": item.get("fit_type", ""),
            "style_tag": item.get("style_tag", ""),
        }
        layer = item.get("layer_type", "")
        if layer:
            entry["layer_type"] = layer
        serialized_items.append(entry)

    categories_present = sorted({item.get("category", "") for item in items if item.get("category", "")})

    payload = {
        "wardrobe_items": serialized_items,
        "categories_available": categories_present,
        "context": {
            "weather": context.get("weather_category", "mild"),
            "time_of_day": context.get("time_category", "work hours"),
            "body_type": context.get("body_type", "rectangle"),
            "occasion": context.get("occasion", "daily"),
            "style_preferences": context.get("style_preferences", []),
        },
    }

    return json.dumps(payload, indent=2)


def get_ai_recommendations(items: list, context: dict) -> Optional[list]:
    """Call Groq to generate outfit recommendations.

    Returns a list of {"item_ids": [...], "explanation": "..."} dicts,
    or None on any failure (caller should fall back to local algorithm).
    """
    client = _get_client()
    if client is None:
        return None

    if not items or len(items) < 2:
        logger.info("Too few items (%d) for AI recommendations", len(items) if items else 0)
        return None

    valid_ids = {str(item.get("id", "")) for item in items}
    item_by_id = {str(item.get("id", "")): item for item in items}

    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": build_system_prompt()},
                {"role": "user", "content": build_user_prompt(items, context)},
            ],
            response_format={"type": "json_object"},
            temperature=0.7,
            max_tokens=1024,
        )

        raw = response.choices[0].message.content
        parsed = json.loads(raw)

        outfits_raw = parsed.get("outfits", [])
        if not isinstance(outfits_raw, list):
            logger.warning("Groq returned non-list outfits: %s", type(outfits_raw))
            return None

        validated = []
        for outfit in outfits_raw:
            if not isinstance(outfit, dict):
                continue

            raw_ids = outfit.get("item_ids", [])
            if not isinstance(raw_ids, list):
                continue

            filtered_ids = [str(id_) for id_ in raw_ids if str(id_) in valid_ids]

            # Deduplicate: keep only the first item per category
            seen_cats = set()
            deduped_ids = []
            for id_ in filtered_ids:
                cat = (item_by_id.get(id_, {}).get("category", "") or "").strip().lower()
                if cat and cat in seen_cats:
                    continue
                if cat:
                    seen_cats.add(cat)
                deduped_ids.append(id_)
            filtered_ids = deduped_ids

            if len(filtered_ids) < 2:
                logger.info("Outfit discarded — only %d valid items", len(filtered_ids))
                continue

            validated.append({
                "item_ids": filtered_ids,
                "explanation": str(outfit.get("explanation", "")).strip() or "Stylish combination.",
            })

        if not validated:
            logger.warning("No valid outfits after filtering hallucinated IDs")
            return None

        return validated[:3]

    except Exception as e:
        logger.error("Groq API call failed: %s", e)
        return None
