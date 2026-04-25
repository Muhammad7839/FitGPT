"""Integration tests for confidence_score compatibility alias in recommendation APIs."""

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


def _seed_wardrobe(client, auth: dict) -> None:
    for name, category in [
        ("Top A", "Top"),
        ("Bottom A", "Bottom"),
        ("Shoes A", "Shoes"),
        ("Top B", "Top"),
        ("Bottom B", "Bottom"),
    ]:
        response = client.post("/wardrobe/items", json=_item_payload(name, category), headers=auth)
        assert response.status_code == 200


def test_recommendation_endpoint_includes_confidence_alias(client):
    token = register_and_login(client, "confidence-reco@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}
    _seed_wardrobe(client, auth)

    response = client.get("/recommendations", headers=auth)
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body["outfit_score"], float)
    assert isinstance(body["confidence_score"], float)
    assert body["confidence_score"] == body["outfit_score"]



def test_ai_recommendation_endpoint_includes_confidence_alias(client):
    token = register_and_login(client, "confidence-ai@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}
    _seed_wardrobe(client, auth)

    response = client.post("/ai/recommendations", json={}, headers=auth)
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body["outfit_score"], float)
    assert isinstance(body["confidence_score"], float)
    assert body["confidence_score"] == body["outfit_score"]
    if body["outfit_options"]:
        first_option = body["outfit_options"][0]
        assert isinstance(first_option["outfit_score"], float)
        assert isinstance(first_option["confidence_score"], float)
        assert first_option["confidence_score"] == first_option["outfit_score"]
