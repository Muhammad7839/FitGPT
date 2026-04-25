"""Integration tests for underused wardrobe alert generation."""

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


def _create_item(client, auth: dict, payload: dict) -> int:
    response = client.post("/wardrobe/items", json=payload, headers=auth)
    assert response.status_code == 200
    return response.json()["id"]


def test_underused_alerts_detect_items_by_usage_and_last_worn(client):
    token = register_and_login(client, "underused-accuracy@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    top_id = _create_item(client, auth, _item_payload("Top", "Top"))
    bottom_id = _create_item(client, auth, _item_payload("Bottom", "Bottom"))
    shoes_id = _create_item(client, auth, _item_payload("Shoes", "Shoes"))

    reference_timestamp = 1_700_000_000
    old_worn_at = reference_timestamp - (40 * 86400)
    recent_worn_at = reference_timestamp - (2 * 86400)

    old_history = client.post(
        "/outfits/history",
        headers=auth,
        json={"item_ids": [top_id], "worn_at_timestamp": old_worn_at},
    )
    assert old_history.status_code == 200

    recent_history = client.post(
        "/outfits/history",
        headers=auth,
        json={"item_ids": [bottom_id], "worn_at_timestamp": recent_worn_at},
    )
    assert recent_history.status_code == 200

    alerts_response = client.get(
        f"/wardrobe/underused-alerts?analysis_window_days=14&reference_timestamp={reference_timestamp}",
        headers=auth,
    )
    assert alerts_response.status_code == 200
    body = alerts_response.json()

    alert_item_ids = {entry["item_id"] for entry in body["alerts"]}
    assert top_id in alert_item_ids
    assert shoes_id in alert_item_ids
    assert bottom_id not in alert_item_ids



def test_underused_alerts_are_user_specific(client):
    token_a = register_and_login(client, "underused-user-a@example.com", "Testpass9x")
    auth_a = {"Authorization": f"Bearer {token_a}"}
    token_b = register_and_login(client, "underused-user-b@example.com", "Testpass9x")
    auth_b = {"Authorization": f"Bearer {token_b}"}

    _create_item(client, auth_a, _item_payload("A Top", "Top"))
    _create_item(client, auth_a, _item_payload("A Bottom", "Bottom"))
    _create_item(client, auth_a, _item_payload("A Shoes", "Shoes"))

    a_alerts = client.get("/wardrobe/underused-alerts", headers=auth_a)
    assert a_alerts.status_code == 200
    b_alerts = client.get("/wardrobe/underused-alerts", headers=auth_b)
    assert b_alerts.status_code == 200

    assert len(a_alerts.json()["alerts"]) >= 1
    assert b_alerts.json()["alerts"] == []



def test_underused_alerts_flag_insufficient_data(client):
    token = register_and_login(client, "underused-insufficient@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    _create_item(client, auth, _item_payload("Top", "Top"))
    _create_item(client, auth, _item_payload("Bottom", "Bottom"))

    alerts_response = client.get("/wardrobe/underused-alerts", headers=auth)
    assert alerts_response.status_code == 200
    body = alerts_response.json()
    assert body["insufficient_data"] is True
