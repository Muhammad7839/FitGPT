"""Integration tests for feedback-signal weighting in recommendation ranking."""

from conftest import register_and_login


def _item_payload(name: str, category: str, *, favorite: bool = False) -> dict:
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
        "is_favorite": favorite,
        "is_archived": False,
        "last_worn_timestamp": None,
    }


def _create_item(client, auth: dict, payload: dict) -> int:
    response = client.post("/wardrobe/items", json=payload, headers=auth)
    assert response.status_code == 200
    return response.json()["id"]


def test_weighting_prefers_favorite_signal(client):
    token = register_and_login(client, "weight-favorite@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    favored_top = _create_item(client, auth, _item_payload("Top Fav", "Top", favorite=True))
    _create_item(client, auth, _item_payload("Top Other", "Top"))
    _create_item(client, auth, _item_payload("Bottom", "Bottom"))
    _create_item(client, auth, _item_payload("Shoes", "Shoes"))

    response = client.get("/recommendations/options?limit=2", headers=auth)
    assert response.status_code == 200
    outfits = response.json()["outfits"]
    assert len(outfits) >= 1
    first_item_ids = {item["id"] for item in outfits[0]["items"]}
    assert favored_top in first_item_ids



def test_weighting_handles_conflicting_signals(client):
    token = register_and_login(client, "weight-conflict@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    favored_top = _create_item(client, auth, _item_payload("Top Fav", "Top", favorite=True))
    alt_top = _create_item(client, auth, _item_payload("Top Alt", "Top"))
    bottom = _create_item(client, auth, _item_payload("Bottom", "Bottom"))
    shoes = _create_item(client, auth, _item_payload("Shoes", "Shoes"))

    for index in range(5):
        history = client.post(
            "/outfits/history",
            headers=auth,
            json={
                "item_ids": [favored_top, bottom, shoes],
                "worn_at_timestamp": 1_700_000_000 + index,
            },
        )
        assert history.status_code == 200

    response = client.get("/recommendations/options?limit=2", headers=auth)
    assert response.status_code == 200
    outfits = response.json()["outfits"]
    assert len(outfits) >= 1
    first_item_ids = {item["id"] for item in outfits[0]["items"]}
    assert alt_top in first_item_ids



def test_weighting_with_sparse_feedback_still_returns_ranked_options(client):
    token = register_and_login(client, "weight-sparse@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    _create_item(client, auth, _item_payload("Top", "Top"))
    _create_item(client, auth, _item_payload("Bottom", "Bottom"))
    _create_item(client, auth, _item_payload("Shoes", "Shoes"))

    response = client.get("/recommendations/options?limit=3", headers=auth)
    assert response.status_code == 200
    outfits = response.json()["outfits"]
    assert outfits
    assert all(isinstance(outfit["outfit_score"], float) for outfit in outfits)
