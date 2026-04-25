"""Personalization signal tests for recommendation interactions over time."""

from conftest import register_and_login


def _create_item(client, auth, *, category: str, color: str, name: str, clothing_type: str):
    response = client.post(
        "/wardrobe/items",
        headers=auth,
        json={
            "name": name,
            "category": category,
            "clothing_type": clothing_type,
            "fit_tag": None,
            "color": color,
            "season": "All",
            "comfort_level": 3,
            "image_url": None,
            "brand": None,
            "is_available": True,
            "is_favorite": False,
            "is_archived": False,
            "last_worn_timestamp": None,
        },
    )
    assert response.status_code == 200
    return response.json()


def _signature_from_outfit(outfit: dict) -> str:
    item_ids = sorted(entry["id"] for entry in outfit["items"])
    return ",".join(str(item_id) for item_id in item_ids)


def test_recommendation_interaction_endpoint_records_signals(client):
    token = register_and_login(client, "interaction-record@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    top = _create_item(client, auth, category="Top", color="Black", name="Black Tee", clothing_type="tee")
    bottom = _create_item(client, auth, category="Bottom", color="Blue", name="Blue Jeans", clothing_type="jeans")
    shoes = _create_item(client, auth, category="Shoes", color="White", name="White Sneakers", clothing_type="sneakers")

    response = client.post(
        "/recommendations/interactions",
        headers=auth,
        json={
            "suggestion_id": ",".join(str(item_id) for item_id in sorted([top["id"], bottom["id"], shoes["id"]])),
            "signal": "like",
            "item_ids": [top["id"], bottom["id"], shoes["id"]],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["signal"] == "like"
    assert body["detail"] == "Interaction recorded"
    assert body["created_at_timestamp"] > 0


def test_recommendation_ranking_changes_after_negative_interaction(client):
    token = register_and_login(client, "interaction-ranking@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    _create_item(client, auth, category="Top", color="Black", name="Black Tee", clothing_type="tee")
    _create_item(client, auth, category="Top", color="White", name="White Tee", clothing_type="tee")
    _create_item(client, auth, category="Bottom", color="Blue", name="Blue Jeans", clothing_type="jeans")
    _create_item(client, auth, category="Shoes", color="White", name="White Sneakers", clothing_type="sneakers")
    _create_item(client, auth, category="Shoes", color="Black", name="Black Sneakers", clothing_type="sneakers")

    initial = client.get("/recommendations/options", headers=auth, params={"weather_category": "mild", "limit": 3})
    assert initial.status_code == 200
    initial_outfits = initial.json()["outfits"]
    assert len(initial_outfits) >= 2
    first_signature = _signature_from_outfit(initial_outfits[0])
    first_ids = [entry["id"] for entry in initial_outfits[0]["items"]]

    signal_response = client.post(
        "/recommendations/interactions",
        headers=auth,
        json={
            "suggestion_id": first_signature,
            "signal": "reject",
            "item_ids": first_ids,
        },
    )
    assert signal_response.status_code == 200

    reranked = client.get("/recommendations/options", headers=auth, params={"weather_category": "mild", "limit": 3})
    assert reranked.status_code == 200
    reranked_signature = _signature_from_outfit(reranked.json()["outfits"][0])
    assert reranked_signature != first_signature


def test_personalization_handles_conflicting_signals_without_crashing(client):
    token = register_and_login(client, "interaction-conflict@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    _create_item(client, auth, category="Top", color="Black", name="Black Tee", clothing_type="tee")
    _create_item(client, auth, category="Bottom", color="Blue", name="Blue Jeans", clothing_type="jeans")
    _create_item(client, auth, category="Shoes", color="White", name="White Sneakers", clothing_type="sneakers")

    options = client.get("/recommendations/options", headers=auth, params={"weather_category": "mild", "limit": 1})
    assert options.status_code == 200
    outfit = options.json()["outfits"][0]
    signature = _signature_from_outfit(outfit)
    item_ids = [entry["id"] for entry in outfit["items"]]

    like = client.post(
        "/recommendations/interactions",
        headers=auth,
        json={"suggestion_id": signature, "signal": "like", "item_ids": item_ids},
    )
    dislike = client.post(
        "/recommendations/interactions",
        headers=auth,
        json={"suggestion_id": signature, "signal": "dislike", "item_ids": item_ids},
    )
    assert like.status_code == 200
    assert dislike.status_code == 200

    after = client.get("/recommendations/options", headers=auth, params={"weather_category": "mild", "limit": 1})
    assert after.status_code == 200
    assert after.json()["outfits"]
