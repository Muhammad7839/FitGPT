from pathlib import Path

from conftest import register_and_login


def cleanup_uploaded_file(image_url: str):
    filename = image_url.replace("/uploads/", "", 1).strip("/")
    upload_path = Path(__file__).resolve().parents[1] / "uploads" / filename
    try:
        if upload_path.exists():
            upload_path.unlink()
    except OSError:
        pass  # Best-effort cleanup; ignore permission errors in sandboxed environments.


def sample_item_payload():
    return {
        "name": "Black Tee",
        "category": "Top",
        "clothing_type": "t-shirt",
        "fit_tag": "regular",
        "color": "Black",
        "season": "Winter",
        "comfort_level": 4,
        "image_url": None,
        "brand": "Uniqlo",
        "is_available": True,
        "is_favorite": False,
        "is_archived": False,
        "last_worn_timestamp": None,
    }


def test_wardrobe_crud_flow(client):
    token = register_and_login(client, "wardrobe@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    create = client.post("/wardrobe/items", json=sample_item_payload(), headers=auth)
    assert create.status_code == 200
    created = create.json()
    item_id = created["id"]

    list_items = client.get("/wardrobe/items", headers=auth)
    assert list_items.status_code == 200
    assert len(list_items.json()["items"]) == 1
    assert list_items.json()["total"] == 1

    updated_payload = sample_item_payload()
    updated_payload["color"] = "Blue"
    update = client.put(f"/wardrobe/items/{item_id}", json=updated_payload, headers=auth)
    assert update.status_code == 200
    assert update.json()["color"] == "Blue"

    delete = client.delete(f"/wardrobe/items/{item_id}", headers=auth)
    assert delete.status_code == 200

    list_after_delete = client.get("/wardrobe/items", headers=auth)
    assert list_after_delete.status_code == 200
    assert list_after_delete.json()["items"] == []
    assert list_after_delete.json()["total"] == 0


def test_wardrobe_partial_update_supports_edit_workflow(client):
    token = register_and_login(client, "wardrobe-edit@example.com", "Testpass9x")
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


def test_wardrobe_include_archived_and_favorite_persistence(client):
    token = register_and_login(client, "wardrobe-flags@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    create = client.post("/wardrobe/items", json=sample_item_payload(), headers=auth)
    assert create.status_code == 200
    item_id = create.json()["id"]

    favorite_update = client.put(
        f"/wardrobe/items/{item_id}",
        json={"is_favorite": True},
        headers=auth,
    )
    assert favorite_update.status_code == 200
    assert favorite_update.json()["is_favorite"] is True

    archive_update = client.put(
        f"/wardrobe/items/{item_id}",
        json={"is_archived": True},
        headers=auth,
    )
    assert archive_update.status_code == 200

    active_only = client.get("/wardrobe/items", headers=auth)
    assert active_only.status_code == 200
    assert active_only.json()["items"] == []

    include_archived = client.get("/wardrobe/items?include_archived=true", headers=auth)
    assert include_archived.status_code == 200
    body = include_archived.json()["items"]
    assert len(body) == 1
    assert body[0]["is_archived"] is True
    assert body[0]["is_favorite"] is True


def test_wardrobe_image_upload_returns_static_url(client):
    token = register_and_login(client, "wardrobe-upload@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}
    files = {"image": ("item.jpg", b"fake-jpeg-binary", "image/jpeg")}

    response = client.post("/wardrobe/items/image", headers=auth, files=files)
    assert response.status_code == 200
    image_url = response.json()["image_url"]
    assert image_url.startswith("/uploads/")
    cleanup_uploaded_file(image_url)


def test_wardrobe_create_accepts_multipart_form_compatibility_payload(client):
    token = register_and_login(client, "wardrobe-multipart@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    response = client.post(
        "/wardrobe/items",
        headers=auth,
        data={
            "name": "Compat Upload",
            "category": "top",
            "color": "black",
            "fit_type": "regular",
            "style_tag": "casual",
            "is_active": "true",
        },
        files={"image": ("item.jpg", b"fake-jpeg-binary", "image/jpeg")},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Compat Upload"
    assert body["category"].lower() == "top"
    assert body["fit_tag"] == "regular"
    assert body["style_tags"] == ["casual"]
    assert body["season"] == "All"
    assert body["comfort_level"] == 3
    assert body["is_available"] is True
    assert body["image_url"].startswith("/uploads/")
    cleanup_uploaded_file(body["image_url"])


def test_wardrobe_update_accepts_is_active_archive_compatibility(client):
    token = register_and_login(client, "wardrobe-archive-compat@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    created = client.post(
        "/wardrobe/items",
        headers=auth,
        json={
            "name": "Archive Compat Tee",
            "category": "Top",
            "color": "Black",
            "season": "All",
            "comfort_level": 3,
        },
    )
    assert created.status_code == 200
    item_id = created.json()["id"]

    archived = client.put(
        f"/wardrobe/items/{item_id}",
        headers=auth,
        json={"is_active": False},
    )
    assert archived.status_code == 200
    assert archived.json()["is_archived"] is True

    active_items = client.get("/wardrobe/items", headers=auth)
    assert active_items.status_code == 200
    assert all(item["id"] != item_id for item in active_items.json()["items"])

    all_items = client.get("/wardrobe/items?include_archived=true", headers=auth)
    assert all_items.status_code == 200
    restored = [item for item in all_items.json()["items"] if item["id"] == item_id]
    assert restored and restored[0]["is_archived"] is True


def test_wardrobe_image_upload_rejects_unsupported_content_type(client):
    token = register_and_login(client, "wardrobe-upload-invalid@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}
    files = {"image": ("item.gif", b"fake-gif-binary", "image/gif")}

    response = client.post("/wardrobe/items/image", headers=auth, files=files)
    assert response.status_code == 400
    assert "Only JPEG, PNG, and WEBP images are allowed" in response.json()["detail"]


def test_wardrobe_image_upload_rejects_oversized_files(client):
    token = register_and_login(client, "wardrobe-upload-oversize@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}
    files = {"image": ("item.jpg", b"x" * (5 * 1024 * 1024 + 1), "image/jpeg")}

    response = client.post("/wardrobe/items/image", headers=auth, files=files)
    assert response.status_code == 413
    assert response.json()["detail"] == "Image exceeds max upload size"


def test_wardrobe_create_rejects_out_of_range_comfort(client):
    token = register_and_login(client, "wardrobe-bad-comfort@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}
    payload = sample_item_payload()
    payload["comfort_level"] = 6

    response = client.post("/wardrobe/items", json=payload, headers=auth)
    assert response.status_code == 422


def test_favorites_mark_unmark_and_retrieve(client):
    token = register_and_login(client, "favorites@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    create = client.post("/wardrobe/items", json=sample_item_payload(), headers=auth)
    assert create.status_code == 200
    item_id = create.json()["id"]

    mark = client.post(
        f"/wardrobe/items/{item_id}/favorite",
        headers=auth,
        json={"is_favorite": True},
    )
    assert mark.status_code == 200
    assert mark.json()["is_favorite"] is True

    favorites = client.get("/wardrobe/items/favorites", headers=auth)
    assert favorites.status_code == 200
    assert len(favorites.json()) == 1
    assert favorites.json()[0]["id"] == item_id

    unmark = client.post(
        f"/wardrobe/items/{item_id}/favorite",
        headers=auth,
        json={"is_favorite": False},
    )
    assert unmark.status_code == 200
    assert unmark.json()["is_favorite"] is False

    favorites_after = client.get("/wardrobe/items/favorites", headers=auth)
    assert favorites_after.status_code == 200
    assert favorites_after.json() == []


def test_wardrobe_search_and_filter_queries(client):
    token = register_and_login(client, "search-filter@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    payload_a = sample_item_payload() | {
        "name": "Oxford Shirt",
        "category": "Top",
        "clothing_type": "shirt",
        "color": "White",
        "season": "All",
        "fit_tag": "slim",
    }
    payload_b = sample_item_payload() | {
        "name": "Workout Shorts",
        "category": "Bottom",
        "clothing_type": "shorts",
        "color": "Black",
        "season": "Summer",
        "fit_tag": "athletic",
    }
    payload_c = sample_item_payload() | {
        "name": "Trail Sneaker",
        "category": "Shoes",
        "clothing_type": "sneakers",
        "color": "Blue",
        "season": "All",
        "fit_tag": "regular",
    }

    assert client.post("/wardrobe/items", json=payload_a, headers=auth).status_code == 200
    assert client.post("/wardrobe/items", json=payload_b, headers=auth).status_code == 200
    assert client.post("/wardrobe/items", json=payload_c, headers=auth).status_code == 200

    search = client.get("/wardrobe/items", headers=auth, params={"search": "oxford"})
    assert search.status_code == 200
    assert len(search.json()["items"]) == 1
    assert search.json()["items"][0]["name"] == "Oxford Shirt"

    empty = client.get("/wardrobe/items", headers=auth, params={"search": "not-found-term"})
    assert empty.status_code == 200
    assert empty.json()["items"] == []

    combined = client.get(
        "/wardrobe/items",
        headers=auth,
        params={
            "category": "Bottom",
            "color": "Black",
            "clothing_type": "shorts",
            "season": "Summer",
        },
    )
    assert combined.status_code == 200
    body = combined.json()["items"]
    assert len(body) == 1
    assert body[0]["name"] == "Workout Shorts"


def test_wardrobe_list_returns_paginated_envelope(client):
    token = register_and_login(client, "pagination@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    for name in ("First", "Second", "Third"):
        assert client.post("/wardrobe/items", json=sample_item_payload() | {"name": name}, headers=auth).status_code == 200

    response = client.get("/wardrobe/items", headers=auth, params={"limit": 2, "offset": 1})
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 3
    assert body["limit"] == 2
    assert body["offset"] == 1
    assert len(body["items"]) == 2

    capped = client.get("/wardrobe/items", headers=auth, params={"limit": 500})
    assert capped.status_code == 200
    assert capped.json()["limit"] == 200


def test_wardrobe_fit_tag_is_stored_and_filterable(client):
    token = register_and_login(client, "fit-tag@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    fitted = sample_item_payload() | {"name": "Slim Jeans", "category": "Bottom", "fit_tag": "slim"}
    relaxed = sample_item_payload() | {"name": "Relaxed Hoodie", "category": "Outerwear", "fit_tag": "relaxed"}

    assert client.post("/wardrobe/items", json=fitted, headers=auth).status_code == 200
    assert client.post("/wardrobe/items", json=relaxed, headers=auth).status_code == 200

    filtered = client.get("/wardrobe/items", headers=auth, params={"fit_tag": "slim"})
    assert filtered.status_code == 200
    body = filtered.json()["items"]
    assert len(body) == 1
    assert body[0]["name"] == "Slim Jeans"


def test_bulk_create_items_returns_per_item_result(client):
    token = register_and_login(client, "bulk-create@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    response = client.post(
        "/wardrobe/items/bulk",
        headers=auth,
        json={
            "items": [
                sample_item_payload() | {"name": "Item A"},
                sample_item_payload() | {"name": "Item B", "category": "Bottom"},
            ]
        },
    )
    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 2
    assert all(result["status"] == "success" for result in results)

    listed = client.get("/wardrobe/items", headers=auth)
    assert listed.status_code == 200
    assert len(listed.json()["items"]) == 2
    assert listed.json()["total"] == 2


def test_multi_file_upload_returns_success_and_failure_per_file(client):
    token = register_and_login(client, "multi-upload@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    files = [
        ("images", ("valid.jpg", b"jpeg-data", "image/jpeg")),
        ("images", ("invalid.gif", b"gif-data", "image/gif")),
    ]
    response = client.post("/wardrobe/items/images", headers=auth, files=files)
    assert response.status_code == 200

    results = response.json()["results"]
    assert len(results) == 2
    assert results[0]["status"] == "success"
    assert results[0]["image_url"].startswith("/uploads/")
    assert results[1]["status"] == "failed"
    assert "Only JPEG, PNG, and WEBP images are allowed" in results[1]["error"]
    cleanup_uploaded_file(results[0]["image_url"])


def test_duplicate_detection_returns_expected_candidates(client):
    token = register_and_login(client, "duplicates@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    first_payload = sample_item_payload() | {
        "name": "Black Tee",
        "category": "Top",
        "clothing_type": "t-shirt",
        "color": "Black",
        "brand": "Uniqlo",
        "style_tags": ["casual"],
    }
    second_payload = sample_item_payload() | {
        "name": "Black T Shirt",
        "category": "Top",
        "clothing_type": "t-shirt",
        "color": "Black",
        "brand": "Uniqlo",
        "style_tags": ["casual"],
    }
    third_payload = sample_item_payload() | {
        "name": "Blue Hoodie",
        "category": "Outerwear",
        "clothing_type": "hoodie",
        "color": "Blue",
        "brand": "Nike",
    }

    first = client.post("/wardrobe/items", json=first_payload, headers=auth)
    second = client.post("/wardrobe/items", json=second_payload, headers=auth)
    third = client.post("/wardrobe/items", json=third_payload, headers=auth)
    assert first.status_code == 200
    assert second.status_code == 200
    assert third.status_code == 200

    first_id = first.json()["id"]
    second_id = second.json()["id"]

    scan = client.get("/wardrobe/duplicates", headers=auth, params={"threshold": 0.7, "limit": 10})
    assert scan.status_code == 200
    candidates = scan.json()["candidates"]
    assert any({entry["item_id"], entry["duplicate_item_id"]} == {first_id, second_id} for entry in candidates)

    item_scan = client.get(f"/wardrobe/items/{first_id}/duplicates", headers=auth, params={"threshold": 0.7})
    assert item_scan.status_code == 200
    item_candidates = item_scan.json()["candidates"]
    assert any(entry["duplicate_item_id"] == second_id for entry in item_candidates)


def test_duplicate_detection_returns_empty_when_items_are_distinct(client):
    token = register_and_login(client, "duplicates-empty@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    top = sample_item_payload() | {
        "name": "Formal White Shirt",
        "category": "Top",
        "clothing_type": "shirt",
        "color": "White",
        "brand": "Uniqlo",
    }
    shoes = sample_item_payload() | {
        "name": "Trail Running Shoes",
        "category": "Shoes",
        "clothing_type": "sneakers",
        "color": "Green",
        "brand": "Nike",
    }
    assert client.post("/wardrobe/items", json=top, headers=auth).status_code == 200
    assert client.post("/wardrobe/items", json=shoes, headers=auth).status_code == 200

    scan = client.get("/wardrobe/duplicates", headers=auth, params={"threshold": 0.85})
    assert scan.status_code == 200
    assert scan.json()["candidates"] == []
