from conftest import register_and_login


def _item_payload(name: str, category: str, color: str):
    return {
        "name": name,
        "category": category,
        "clothing_type": None,
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
    }


def test_auth_aliases_match_canonical_routes(client):
    register_primary = client.post(
        "/register",
        json={"email": "alias-primary@example.com", "password": "password123"},
    )
    assert register_primary.status_code == 200

    register_alias = client.post(
        "/auth/register",
        json={"email": "alias-secondary@example.com", "password": "password123"},
    )
    assert register_alias.status_code == 200

    login_primary = client.post(
        "/login",
        data={"username": "alias-primary@example.com", "password": "password123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert login_primary.status_code == 200
    assert login_primary.json()["token_type"] == "bearer"

    login_alias = client.post(
        "/auth/login",
        json={"email": "alias-secondary@example.com", "password": "password123"},
    )
    assert login_alias.status_code == 200
    assert login_alias.json()["token_type"] == "bearer"

    primary_auth = {"Authorization": f"Bearer {login_primary.json()['access_token']}"}
    alias_auth = {"Authorization": f"Bearer {login_alias.json()['access_token']}"}

    me_primary = client.get("/me", headers=primary_auth)
    me_alias = client.get("/auth/me", headers=primary_auth)
    assert me_primary.status_code == 200
    assert me_alias.status_code == 200
    assert me_primary.json()["email"] == me_alias.json()["email"] == "alias-primary@example.com"

    me_secondary = client.get("/me", headers=alias_auth)
    me_secondary_alias = client.get("/auth/me", headers=alias_auth)
    assert me_secondary.status_code == 200
    assert me_secondary_alias.status_code == 200
    assert me_secondary.json()["email"] == me_secondary_alias.json()["email"] == "alias-secondary@example.com"


def test_profile_aliases_match_canonical_routes(client):
    token = register_and_login(client, "profile-alias@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    update = client.put(
        "/profile",
        headers=auth,
        json={
            "body_type": "athletic",
            "style_preferences": ["Minimalist"],
            "comfort_preferences": ["Balanced"],
            "dress_for": ["Work"],
            "gender": "woman",
            "height_cm": 170,
            "onboarding_complete": True,
        },
    )
    assert update.status_code == 200

    me = client.get("/me", headers=auth)
    profile = client.get("/profile", headers=auth)
    assert me.status_code == 200
    assert profile.status_code == 200
    assert me.json()["body_type"] == "athletic"
    assert profile.json()["body_type"] == "athletic"
    assert profile.json()["style_preferences"] == ["Minimalist"]
    assert profile.json()["comfort_preferences"] == ["Balanced"]
    assert profile.json()["dress_for"] == ["Work"]


def test_ai_recommendation_alias_wraps_same_primary_outfit(client, monkeypatch):
    token = register_and_login(client, "ai-alias@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    top = client.post("/wardrobe/items", headers=auth, json=_item_payload("Alias Top", "Top", "Black")).json()
    bottom = client.post("/wardrobe/items", headers=auth, json=_item_payload("Alias Bottom", "Bottom", "Blue")).json()
    shoes = client.post("/wardrobe/items", headers=auth, json=_item_payload("Alias Shoes", "Shoes", "White")).json()

    monkeypatch.setattr("app.routes.fetch_current_temperature_f", lambda *_args, **_kwargs: 55)

    primary = client.post("/ai/recommendations", headers=auth, json={})
    compat = client.post(
        "/recommendations/ai",
        headers=auth,
        json={"context": {"weather_category": "mild"}},
    )
    assert primary.status_code == 200
    assert compat.status_code == 200

    primary_body = primary.json()
    compat_body = compat.json()
    primary_ids = sorted(str(item["id"]) for item in primary_body["items"])

    assert set(primary_ids).issubset({str(top["id"]), str(bottom["id"]), str(shoes["id"])})
    assert primary_ids
    assert "source" in compat_body
    assert "fallback_used" in compat_body
    assert compat_body["outfits"][0]["item_ids"] == primary_ids


def test_saved_outfit_aliases_interoperate_with_canonical_routes(client):
    token = register_and_login(client, "saved-alias-cross@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    top = client.post("/wardrobe/items", headers=auth, json=_item_payload("Saved Top", "Top", "Black")).json()
    bottom = client.post("/wardrobe/items", headers=auth, json=_item_payload("Saved Bottom", "Bottom", "Blue")).json()

    created = client.post(
        "/outfits/saved",
        headers=auth,
        json={"item_ids": [top["id"], bottom["id"]], "saved_at_timestamp": 1730001000},
    )
    assert created.status_code == 200

    listed = client.get("/saved-outfits", headers=auth)
    assert listed.status_code == 200
    saved = listed.json()["saved_outfits"]
    assert len(saved) == 1

    signature = saved[0]["outfit_signature"]
    deleted = client.delete(f"/saved-outfits/{signature}", headers=auth)
    assert deleted.status_code == 200
    assert deleted.json()["deleted"] is True

    canonical_after = client.get("/outfits/saved", headers=auth)
    assert canonical_after.status_code == 200
    assert canonical_after.json()["outfits"] == []


def test_outfit_history_aliases_interoperate_with_canonical_routes(client):
    token = register_and_login(client, "history-alias-cross@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    top = client.post("/wardrobe/items", headers=auth, json=_item_payload("History Top", "Top", "Black")).json()
    bottom = client.post("/wardrobe/items", headers=auth, json=_item_payload("History Bottom", "Bottom", "Blue")).json()

    created = client.post(
        "/outfit-history",
        headers=auth,
        json={"item_ids": [top["id"], bottom["id"]], "worn_at_timestamp": 1730000000},
    )
    assert created.status_code == 200

    listed = client.get("/outfits/history", headers=auth)
    assert listed.status_code == 200
    history = listed.json()["history"]
    assert len(history) == 1

    deleted = client.delete(f"/outfits/history/{history[0]['id']}", headers=auth)
    assert deleted.status_code == 200

    legacy_after = client.get("/outfit-history", headers=auth)
    assert legacy_after.status_code == 200
    assert legacy_after.json()["history"] == []


def test_chat_conversation_compatibility_endpoints_return_local_only_status(client):
    token = register_and_login(client, "chat-conversations@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    listed = client.get("/chat/conversations", headers=auth)
    assert listed.status_code == 200
    assert listed.json() == {
        "conversations": [],
        "local_only": True,
    }

    synced = client.put(
        "/chat/conversations",
        headers=auth,
        json={
            "conversations": [
                {
                    "id": "chat-1",
                    "title": "Office outfit",
                    "messages": [{"role": "user", "content": "What should I wear?"}],
                    "created_at": "2026-04-21T12:00:00Z",
                    "updated_at": "2026-04-21T12:01:00Z",
                }
            ]
        },
    )
    assert synced.status_code == 200
    assert synced.json() == {
        "saved": False,
        "local_only": True,
    }
