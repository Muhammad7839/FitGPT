"""Integration tests for wardrobe gap analysis endpoint behavior."""

from conftest import register_and_login


def _item_payload(category: str, name: str) -> dict:
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


def test_wardrobe_gaps_handles_empty_wardrobe(client):
    token = register_and_login(client, "gaps-empty@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    response = client.get("/wardrobe/gaps", headers=auth)
    assert response.status_code == 200
    body = response.json()

    assert body["insufficient_data"] is True
    assert set(body["baseline_categories"]) == {"top", "bottom", "shoes", "outerwear"}
    assert set(body["missing_categories"]) == {"top", "bottom", "shoes", "outerwear"}
    assert len(body["suggestions"]) == 4
    for suggestion in body["suggestions"]:
        assert suggestion["shopping_link"].startswith("https://www.target.com/s?searchTerm=")
        assert suggestion["image_url"].startswith("https://")


def test_wardrobe_gaps_detects_missing_categories_accuracy(client):
    token = register_and_login(client, "gaps-accuracy@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    create_top = client.post("/wardrobe/items", json=_item_payload("Top", "Black Tee"), headers=auth)
    assert create_top.status_code == 200
    create_bottom = client.post("/wardrobe/items", json=_item_payload("Bottom", "Blue Jeans"), headers=auth)
    assert create_bottom.status_code == 200

    response = client.get("/wardrobe/gaps", headers=auth)
    assert response.status_code == 200
    body = response.json()

    assert body["category_counts"]["top"] == 1
    assert body["category_counts"]["bottom"] == 1
    assert body["category_counts"]["shoes"] == 0
    assert body["category_counts"]["outerwear"] == 0
    assert set(body["missing_categories"]) == {"top", "bottom", "shoes", "outerwear"}



def test_wardrobe_gaps_are_user_scoped(client):
    token_a = register_and_login(client, "gaps-user-a@example.com", "password123")
    auth_a = {"Authorization": f"Bearer {token_a}"}
    token_b = register_and_login(client, "gaps-user-b@example.com", "password123")
    auth_b = {"Authorization": f"Bearer {token_b}"}

    categories = ["Top", "Top", "Bottom", "Bottom", "Shoes", "Outerwear"]
    for index, category in enumerate(categories):
        create = client.post(
            "/wardrobe/items",
            json=_item_payload(category, f"Item {index}"),
            headers=auth_a,
        )
        assert create.status_code == 200

    user_a_response = client.get("/wardrobe/gaps", headers=auth_a)
    assert user_a_response.status_code == 200
    user_a_body = user_a_response.json()
    assert user_a_body["missing_categories"] == []
    assert user_a_body["insufficient_data"] is False

    user_b_response = client.get("/wardrobe/gaps", headers=auth_b)
    assert user_b_response.status_code == 200
    user_b_body = user_b_response.json()
    assert set(user_b_body["missing_categories"]) == {"top", "bottom", "shoes", "outerwear"}
    assert user_b_body["insufficient_data"] is True
