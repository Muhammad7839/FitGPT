"""Integration tests for wardrobe CRUD behavior."""

from conftest import register_and_login


def sample_item_payload():
    return {
        "category": "Top",
        "color": "Black",
        "season": "Winter",
        "comfort_level": 4,
        "image_url": None,
        "brand": "Uniqlo",
        "is_available": True,
        "is_archived": False,
        "last_worn_timestamp": None,
    }


def test_wardrobe_crud_flow(client):
    token = register_and_login(client, "wardrobe@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    create = client.post("/wardrobe/items", json=sample_item_payload(), headers=auth)
    assert create.status_code == 200
    created = create.json()
    item_id = created["id"]

    list_items = client.get("/wardrobe/items", headers=auth)
    assert list_items.status_code == 200
    assert len(list_items.json()) == 1

    updated_payload = sample_item_payload()
    updated_payload["color"] = "Blue"
    update = client.put(f"/wardrobe/items/{item_id}", json=updated_payload, headers=auth)
    assert update.status_code == 200
    assert update.json()["color"] == "Blue"

    delete = client.delete(f"/wardrobe/items/{item_id}", headers=auth)
    assert delete.status_code == 200

    list_after_delete = client.get("/wardrobe/items", headers=auth)
    assert list_after_delete.status_code == 200
    assert list_after_delete.json() == []


def test_wardrobe_partial_update_supports_edit_workflow(client):
    token = register_and_login(client, "wardrobe-edit@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    create = client.post("/wardrobe/items", json=sample_item_payload(), headers=auth)
    item_id = create.json()["id"]

    update = client.put(
        f"/wardrobe/items/{item_id}",
        json={"color": "Olive"},
        headers=auth,
    )
    assert update.status_code == 200
    body = update.json()
    assert body["color"] == "Olive"
    assert body["category"] == "Top"
