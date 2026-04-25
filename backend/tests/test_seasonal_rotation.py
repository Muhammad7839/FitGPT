"""Integration tests for current-season default filtering and seasonal fallback behavior."""

from conftest import register_and_login


def _item_payload(name: str, category: str, season: str, season_tags: list[str]) -> dict:
    return {
        "name": name,
        "category": category,
        "clothing_type": "basic",
        "fit_tag": "regular",
        "color": "Black",
        "season": season,
        "season_tags": season_tags,
        "comfort_level": 4,
        "image_url": None,
        "brand": "FitGPT",
        "is_available": True,
        "is_favorite": False,
        "is_archived": False,
        "last_worn_timestamp": None,
    }


def _create_item(client, auth: dict, payload: dict) -> int:
    response = client.post("/wardrobe/items", json=payload, headers=auth)
    assert response.status_code == 200
    return response.json()["id"]


def test_default_current_season_filter_applies_to_recommendations(client, monkeypatch):
    token = register_and_login(client, "season-default@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    monkeypatch.setattr("app.crud.get_current_season_tag", lambda **_: "winter")

    winter_top = _create_item(client, auth, _item_payload("Winter Top", "Top", "Winter", ["winter"]))
    _create_item(client, auth, _item_payload("Summer Top", "Top", "Summer", ["summer"]))
    _create_item(client, auth, _item_payload("Bottom", "Bottom", "All", ["all"]))
    _create_item(client, auth, _item_payload("Shoes", "Shoes", "All", ["all"]))

    response = client.get("/recommendations/options?limit=1", headers=auth)
    assert response.status_code == 200
    first_outfit_item_ids = {item["id"] for item in response.json()["outfits"][0]["items"]}
    assert winter_top in first_outfit_item_ids



def test_multi_season_items_are_handled(client, monkeypatch):
    token = register_and_login(client, "season-multi@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    monkeypatch.setattr("app.crud.get_current_season_tag", lambda **_: "summer")

    multi_top = _create_item(client, auth, _item_payload("Multi Top", "Top", "All", ["spring", "summer"]))
    _create_item(client, auth, _item_payload("Winter Top", "Top", "Winter", ["winter"]))
    _create_item(client, auth, _item_payload("Bottom", "Bottom", "All", ["all"]))
    _create_item(client, auth, _item_payload("Shoes", "Shoes", "All", ["all"]))

    response = client.get("/recommendations/options?limit=1", headers=auth)
    assert response.status_code == 200
    first_outfit_item_ids = {item["id"] for item in response.json()["outfits"][0]["items"]}
    assert multi_top in first_outfit_item_ids



def test_missing_season_tags_fallback_still_returns_recommendations(client, monkeypatch):
    token = register_and_login(client, "season-fallback@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    monkeypatch.setattr("app.crud.get_current_season_tag", lambda **_: "winter")

    _create_item(client, auth, _item_payload("Top", "Top", "All", []))
    _create_item(client, auth, _item_payload("Bottom", "Bottom", "All", []))
    _create_item(client, auth, _item_payload("Shoes", "Shoes", "All", []))

    response = client.get("/recommendations/options?limit=1", headers=auth)
    assert response.status_code == 200
    outfits = response.json()["outfits"]
    assert outfits
    assert outfits[0]["items"]
