"""Integration tests for feedback prompt cadence and interaction tracking."""

from conftest import register_and_login


def _item_payload(name: str, category: str) -> dict:
    return {
        "name": name,
        "category": category,
        "clothing_type": "basic",
        "fit_tag": "regular",
        "color": "Black",
        "season": "All",
        "comfort_level": 4,
        "image_url": None,
        "brand": "FitGPT",
        "is_available": True,
        "is_favorite": False,
        "is_archived": False,
        "last_worn_timestamp": None,
    }


def _seed_minimum_wardrobe(client, auth: dict) -> None:
    payloads = [
        _item_payload("Top A", "Top"),
        _item_payload("Bottom A", "Bottom"),
        _item_payload("Shoes A", "Shoes"),
    ]
    for payload in payloads:
        response = client.post("/wardrobe/items", json=payload, headers=auth)
        assert response.status_code == 200


def test_prompt_timing_metadata_respects_cooldown(client):
    token = register_and_login(client, "prompt-timing@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}
    _seed_minimum_wardrobe(client, auth)

    first = client.post("/ai/recommendations", json={}, headers=auth)
    assert first.status_code == 200
    first_meta = first.json()["prompt_feedback"]
    assert first_meta["should_prompt"] is True

    second = client.post("/ai/recommendations", json={}, headers=auth)
    assert second.status_code == 200
    second_meta = second.json()["prompt_feedback"]
    assert second_meta["should_prompt"] is False
    assert second_meta["cooldown_seconds_remaining"] > 0


def test_prompt_interactions_are_recorded(client):
    token = register_and_login(client, "prompt-interaction@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}
    _seed_minimum_wardrobe(client, auth)

    recommendation = client.post("/ai/recommendations", json={}, headers=auth)
    assert recommendation.status_code == 200
    suggestion_id = recommendation.json().get("suggestion_id")

    interaction = client.post(
        "/feedback/prompts/event",
        json={"event_type": "ignored", "suggestion_id": suggestion_id},
        headers=auth,
    )
    assert interaction.status_code == 200

    follow_up = client.post("/ai/recommendations", json={}, headers=auth)
    assert follow_up.status_code == 200
    follow_up_meta = follow_up.json()["prompt_feedback"]
    assert follow_up_meta["should_prompt"] is False


def test_prompt_metadata_handles_high_frequency_requests(client):
    token = register_and_login(client, "prompt-frequency@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}
    _seed_minimum_wardrobe(client, auth)

    prompt_true_count = 0
    for _ in range(10):
        response = client.post("/ai/recommendations", json={}, headers=auth)
        assert response.status_code == 200
        metadata = response.json()["prompt_feedback"]
        if metadata["should_prompt"]:
            prompt_true_count += 1

    assert prompt_true_count <= 1
