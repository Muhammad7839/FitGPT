"""Integration tests for rejected outfit persistence and filtering behavior."""

from conftest import register_and_login


def _item_payload(name: str, category: str, clothing_type: str) -> dict:
    return {
        "name": name,
        "category": category,
        "clothing_type": clothing_type,
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


def _create_items(client, auth: dict, payloads: list[dict]) -> list[int]:
    ids: list[int] = []
    for payload in payloads:
        response = client.post("/wardrobe/items", json=payload, headers=auth)
        assert response.status_code == 200
        ids.append(response.json()["id"])
    return ids


def test_rejected_outfit_is_stored_and_duplicate_is_idempotent(client):
    token = register_and_login(client, "reject-store@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    item_ids = _create_items(
        client,
        auth,
        [
            _item_payload("Top A", "Top", "tee"),
            _item_payload("Bottom A", "Bottom", "jeans"),
            _item_payload("Shoes A", "Shoes", "sneakers"),
        ],
    )
    fingerprint = ",".join(str(item_id) for item_id in sorted(item_ids))

    first = client.post(
        "/recommendations/reject",
        headers=auth,
        json={"item_ids": item_ids, "suggestion_id": fingerprint},
    )
    assert first.status_code == 200
    assert first.json()["created"] is True

    second = client.post(
        "/recommendations/reject",
        headers=auth,
        json={"item_ids": item_ids, "suggestion_id": fingerprint},
    )
    assert second.status_code == 200
    assert second.json()["created"] is False


def test_recommendations_avoid_rejected_outfit_fingerprint(client):
    token = register_and_login(client, "reject-filter@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    _create_items(
        client,
        auth,
        [
            _item_payload("Top A", "Top", "tee"),
            _item_payload("Top B", "Top", "shirt"),
            _item_payload("Bottom A", "Bottom", "jeans"),
            _item_payload("Bottom B", "Bottom", "chinos"),
            _item_payload("Shoes A", "Shoes", "sneakers"),
            _item_payload("Shoes B", "Shoes", "boots"),
        ],
    )

    first = client.get("/recommendations?weather_category=mild", headers=auth)
    assert first.status_code == 200
    first_ids = sorted(item["id"] for item in first.json()["items"])
    assert first_ids

    first_fingerprint = ",".join(str(item_id) for item_id in first_ids)
    reject = client.post(
        "/recommendations/reject",
        headers=auth,
        json={"item_ids": first_ids, "suggestion_id": first_fingerprint},
    )
    assert reject.status_code == 200

    second = client.get("/recommendations?weather_category=mild", headers=auth)
    assert second.status_code == 200
    second_ids = sorted(item["id"] for item in second.json()["items"])
    assert second_ids
    assert second_ids != first_ids


def test_rejected_outfits_edge_cases_no_data_and_large_history(client):
    token_a = register_and_login(client, "reject-edge-a@example.com", "password123")
    auth_a = {"Authorization": f"Bearer {token_a}"}
    token_b = register_and_login(client, "reject-edge-b@example.com", "password123")
    auth_b = {"Authorization": f"Bearer {token_b}"}

    no_data = client.get("/recommendations", headers=auth_b)
    assert no_data.status_code == 200
    assert no_data.json()["items"] == []

    item_ids = _create_items(
        client,
        auth_a,
        [
            _item_payload("Top A", "Top", "tee"),
            _item_payload("Bottom A", "Bottom", "jeans"),
            _item_payload("Shoes A", "Shoes", "sneakers"),
        ],
    )

    for index in range(30):
        response = client.post(
            "/recommendations/reject",
            headers=auth_a,
            json={"item_ids": item_ids, "suggestion_id": f"hist-{index}"},
        )
        assert response.status_code == 200

    result = client.get("/recommendations", headers=auth_a)
    assert result.status_code == 200
    assert isinstance(result.json()["items"], list)
