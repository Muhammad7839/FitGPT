"""Integration tests for recommendations and outfit history endpoints."""

from conftest import register_and_login


def item(category: str, color: str):
    return {
        "category": category,
        "color": color,
        "season": "All",
        "comfort_level": 3,
        "image_url": None,
        "brand": None,
        "is_available": True,
        "is_archived": False,
        "last_worn_timestamp": None,
    }


def test_recommendations_and_history_flow(client):
    token = register_and_login(client, "reco@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    top = client.post("/wardrobe/items", json=item("Top", "Black"), headers=auth).json()
    bottom = client.post("/wardrobe/items", json=item("Bottom", "Blue"), headers=auth).json()
    shoes = client.post("/wardrobe/items", json=item("Shoes", "White"), headers=auth).json()

    reco = client.get(
        "/recommendations",
        headers=auth,
        params={
            "manual_temp": 55,
            "time_context": "Evening",
            "plan_date": "2026-03-06",
            "exclude": "neon,formal",
        },
    )
    assert reco.status_code == 200
    reco_body = reco.json()
    assert "items" in reco_body
    assert len(reco_body["items"]) >= 2
    assert isinstance(reco_body["explanation"], str)
    assert "evening" in reco_body["explanation"].lower()
    assert "55f" in reco_body["explanation"].lower()
    assert "neon" in reco_body["explanation"].lower()
    assert "temp=" not in reco_body["explanation"]

    history = client.post(
        "/outfits/history",
        headers=auth,
        json={
            "item_ids": [top["id"], bottom["id"], shoes["id"]],
            "worn_at_timestamp": 1730000000,
        },
    )
    assert history.status_code == 200
    assert history.json()["detail"] == "Outfit history saved"


def test_saved_outfits_returns_updated_data_and_persists(client):
    token = register_and_login(client, "saved@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    top = client.post("/wardrobe/items", json=item("Top", "Black"), headers=auth).json()
    bottom = client.post("/wardrobe/items", json=item("Bottom", "Blue"), headers=auth).json()

    first_save = client.post(
        "/outfits/saved",
        headers=auth,
        json={
            "item_ids": [top["id"], bottom["id"]],
            "saved_at_timestamp": 1730001000,
        },
    )
    assert first_save.status_code == 200
    first_body = first_save.json()
    assert len(first_body["outfits"]) == 1
    assert first_body["outfits"][0]["item_ids"] == [top["id"], bottom["id"]]

    second_save = client.post(
        "/outfits/saved",
        headers=auth,
        json={
            "item_ids": [bottom["id"]],
            "saved_at_timestamp": 1730002000,
        },
    )
    assert second_save.status_code == 200
    second_body = second_save.json()
    assert len(second_body["outfits"]) == 2
    assert second_body["outfits"][0]["item_ids"] == [bottom["id"]]
    assert second_body["outfits"][0]["saved_at_timestamp"] == 1730002000

    list_saved = client.get("/outfits/saved", headers=auth)
    assert list_saved.status_code == 200
    list_body = list_saved.json()
    assert len(list_body["outfits"]) == 2
    assert list_body["outfits"][1]["saved_at_timestamp"] == 1730001000
