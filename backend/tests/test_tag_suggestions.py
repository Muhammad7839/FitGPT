"""Coverage for wardrobe tag suggestion generation and application flows."""

from conftest import register_and_login


def _base_item_payload():
    return {
        "name": "Black blazer",
        "category": "Top",
        "clothing_type": None,
        "fit_tag": None,
        "color": "Black",
        "season": "All",
        "comfort_level": 3,
        "image_url": None,
        "brand": None,
        "is_available": True,
        "is_favorite": False,
        "is_archived": False,
        "last_worn_timestamp": None,
    }


def test_tag_suggestions_generate_and_persist_on_item_create(client):
    token = register_and_login(client, "tags-create@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    created = client.post("/wardrobe/items", headers=auth, json=_base_item_payload())
    assert created.status_code == 200
    body = created.json()
    assert body["suggested_colors"] == ["Black"]
    assert body["suggested_fit_tag"] == "regular"
    assert len(body["suggested_style_tags"]) >= 1

    listed = client.get("/wardrobe/items", headers=auth)
    assert listed.status_code == 200
    persisted = listed.json()["items"][0]
    assert persisted["id"] == body["id"]
    assert persisted["suggested_colors"] == ["Black"]
    assert persisted["suggested_fit_tag"] == "regular"


def test_apply_tag_suggestions_fills_missing_fields_without_overwriting(client):
    token = register_and_login(client, "tags-apply@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    payload = _base_item_payload() | {
        "name": "Gym shorts",
        "category": "Bottom",
        "fit_tag": "slim",
        "style_tags": ["custom-style"],
    }
    created = client.post("/wardrobe/items", headers=auth, json=payload)
    assert created.status_code == 200
    item_id = created.json()["id"]

    applied = client.post(f"/wardrobe/items/{item_id}/tag-suggestions/apply", headers=auth)
    assert applied.status_code == 200
    updated = applied.json()
    assert updated["fit_tag"] == "slim"
    assert updated["style_tags"] == ["custom-style"]
    assert updated["occasion_tags"] in (["daily"], ["gym"])


def test_preview_tag_suggestions_handles_minimal_input(client):
    token = register_and_login(client, "tags-preview@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    response = client.post(
        "/wardrobe/tags/suggest",
        headers=auth,
        json={
            "name": "Item",
            "category": "Accessories",
            "clothing_type": None,
            "fit_tag": None,
            "color": "Blue",
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
    body = response.json()
    assert body["generated"] is True
    assert body["suggested_colors"] == ["Blue"]
