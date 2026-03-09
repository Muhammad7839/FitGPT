from pathlib import Path

from app.google_oauth import GoogleTokenValidationError

from conftest import register_and_login


def _cleanup_uploaded_file(image_url: str):
    filename = image_url.replace("/uploads/", "", 1).strip("/")
    upload_path = Path(__file__).resolve().parents[1] / "uploads" / filename
    if upload_path.exists():
        upload_path.unlink()


def test_register_and_login_success(client):
    token = register_and_login(client, "user1@example.com", "password123")
    assert token


def test_login_fails_with_wrong_password(client):
    register_and_login(client, "user2@example.com", "password123")
    bad_login = client.post(
        "/login",
        data={"username": "user2@example.com", "password": "wrong-pass"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert bad_login.status_code == 401


def test_get_me_and_update_profile(client):
    token = register_and_login(client, "user3@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    me = client.get("/me", headers=auth)
    assert me.status_code == 200
    assert me.json()["email"] == "user3@example.com"
    assert me.json()["avatar_url"] is None

    update = client.put(
        "/me/profile",
        headers=auth,
        json={
            "body_type": "athletic",
            "lifestyle": "active",
            "comfort_preference": "high",
            "onboarding_complete": True,
        },
    )
    assert update.status_code == 200
    body = update.json()
    assert body["body_type"] == "athletic"
    assert body["onboarding_complete"] is True
    assert body["avatar_url"] is None


def test_onboarding_complete_allows_skipped_preferences(client):
    token = register_and_login(client, "onboarding-skip@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    response = client.post("/onboarding/complete", headers=auth, json={})
    assert response.status_code == 200
    body = response.json()
    assert body["onboarding_complete"] is True
    assert body["body_type"] == "unspecified"
    assert body["lifestyle"] == "casual"
    assert body["comfort_preference"] == "medium"


def test_profile_summary_returns_preferences_and_counts(client):
    token = register_and_login(client, "summary@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    top = client.post(
        "/wardrobe/items",
        json={
            "name": "Oxford Shirt",
            "category": "Top",
            "clothing_type": "shirt",
            "fit_tag": "regular",
            "color": "White",
            "season": "All",
            "comfort_level": 4,
            "image_url": None,
            "brand": "Uniqlo",
            "is_available": True,
            "is_favorite": False,
            "is_archived": False,
            "last_worn_timestamp": None,
        },
        headers=auth,
    )
    bottom = client.post(
        "/wardrobe/items",
        json={
            "name": "Chino Pants",
            "category": "Bottom",
            "clothing_type": "pants",
            "fit_tag": "regular",
            "color": "Navy",
            "season": "All",
            "comfort_level": 4,
            "image_url": None,
            "brand": "Levi's",
            "is_available": True,
            "is_favorite": False,
            "is_archived": False,
            "last_worn_timestamp": None,
        },
        headers=auth,
    )
    assert top.status_code == 200
    assert bottom.status_code == 200
    top_id = top.json()["id"]
    bottom_id = bottom.json()["id"]

    favorite = client.post(
        f"/wardrobe/items/{top_id}/favorite",
        headers=auth,
        json={"is_favorite": True},
    )
    assert favorite.status_code == 200

    saved = client.post(
        "/outfits/saved",
        headers=auth,
        json={"item_ids": [top_id, bottom_id], "saved_at_timestamp": 1731111111},
    )
    assert saved.status_code == 200

    planned = client.post(
        "/outfits/planned",
        headers=auth,
        json={
            "item_ids": [top_id, bottom_id],
            "planned_date": "2026-04-30",
            "occasion": "Work",
            "created_at_timestamp": 1732222222,
        },
    )
    assert planned.status_code == 200

    history = client.post(
        "/outfits/history",
        headers=auth,
        json={"item_ids": [top_id, bottom_id], "worn_at_timestamp": 1733333333},
    )
    assert history.status_code == 200

    summary = client.get("/me/summary", headers=auth)
    assert summary.status_code == 200
    body = summary.json()
    assert body["email"] == "summary@example.com"
    assert body["avatar_url"] is None
    assert body["body_type"] == "unspecified"
    assert body["lifestyle"] == "casual"
    assert body["comfort_preference"] == "medium"
    assert body["wardrobe_count"] == 2
    assert body["active_wardrobe_count"] == 2
    assert body["favorite_count"] == 1
    assert body["saved_outfit_count"] == 1
    assert body["planned_outfit_count"] == 1
    assert body["history_count"] == 1


def test_google_login_creates_new_user(client, monkeypatch):
    class Identity:
        email = "google-new@example.com"
        full_name = "Google New"

    monkeypatch.setattr("app.routes.verify_google_id_token", lambda _: Identity())

    response = client.post("/login/google", json={"id_token": "fake-token-value-0000000000"})
    assert response.status_code == 200
    token = response.json()["access_token"]

    me = client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "google-new@example.com"


def test_google_login_returns_existing_user(client, monkeypatch):
    register_and_login(client, "google-existing@example.com", "password123")

    class Identity:
        email = "google-existing@example.com"
        full_name = "Existing User"

    monkeypatch.setattr("app.routes.verify_google_id_token", lambda _: Identity())

    response = client.post("/login/google", json={"id_token": "fake-token-value-1111111111"})
    assert response.status_code == 200
    token = response.json()["access_token"]

    me = client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "google-existing@example.com"


def test_google_login_invalid_or_expired_token_handling(client, monkeypatch):
    def invalid_verify(_: str):
        raise GoogleTokenValidationError("Invalid Google token")

    monkeypatch.setattr("app.routes.verify_google_id_token", invalid_verify)
    invalid_response = client.post("/login/google", json={"id_token": "bad-token-value-2222222222"})
    assert invalid_response.status_code == 400
    assert invalid_response.json()["detail"] == "Invalid Google token"

    def expired_verify(_: str):
        raise GoogleTokenValidationError("Google token has expired", is_expired=True)

    monkeypatch.setattr("app.routes.verify_google_id_token", expired_verify)
    expired_response = client.post("/login/google", json={"id_token": "expired-token-value-33333333"})
    assert expired_response.status_code == 401
    assert expired_response.json()["detail"] == "Google token has expired"


def test_forgot_and_reset_password_flow(client, monkeypatch):
    monkeypatch.setattr("app.routes.EXPOSE_RESET_TOKEN_IN_RESPONSE", True)
    register_and_login(client, "resetme@example.com", "password123")

    forgot = client.post("/forgot-password", json={"email": "resetme@example.com"})
    assert forgot.status_code == 200
    reset_token = forgot.json()["reset_token"]
    assert reset_token

    reset = client.post(
        "/reset-password",
        json={"token": reset_token, "new_password": "newpass456"},
    )
    assert reset.status_code == 200
    assert reset.json()["detail"] == "Password reset successful"

    old_login = client.post(
        "/login",
        data={"username": "resetme@example.com", "password": "password123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert old_login.status_code == 401

    new_login = client.post(
        "/login",
        data={"username": "resetme@example.com", "password": "newpass456"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert new_login.status_code == 200


def test_reset_password_rejects_invalid_token(client):
    response = client.post(
        "/reset-password",
        json={"token": "invalid-token-value-12345", "new_password": "newpass456"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid or expired reset token"


def test_forgot_password_hides_reset_token_when_exposure_disabled(client):
    register_and_login(client, "reset-hidden@example.com", "password123")

    forgot = client.post("/forgot-password", json={"email": "reset-hidden@example.com"})
    assert forgot.status_code == 200
    body = forgot.json()
    assert body["reset_token"] is None
    assert body["detail"] == "If the account exists, reset instructions were issued"


def test_avatar_upload_updates_me_and_summary_and_persists_after_relogin(client):
    token = register_and_login(client, "avatar@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    upload = client.post(
        "/me/avatar",
        headers=auth,
        files={"image": ("avatar.png", b"avatar-bytes", "image/png")},
    )
    assert upload.status_code == 200
    avatar_url = upload.json()["avatar_url"]
    assert avatar_url.startswith("/uploads/avatar_")

    me = client.get("/me", headers=auth)
    assert me.status_code == 200
    assert me.json()["avatar_url"] == avatar_url

    summary = client.get("/me/summary", headers=auth)
    assert summary.status_code == 200
    assert summary.json()["avatar_url"] == avatar_url

    relogin = client.post(
        "/login",
        data={"username": "avatar@example.com", "password": "password123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert relogin.status_code == 200
    relogin_token = relogin.json()["access_token"]
    me_after_relogin = client.get(
        "/me",
        headers={"Authorization": f"Bearer {relogin_token}"},
    )
    assert me_after_relogin.status_code == 200
    assert me_after_relogin.json()["avatar_url"] == avatar_url

    _cleanup_uploaded_file(avatar_url)


def test_avatar_upload_rejects_invalid_content_type(client):
    token = register_and_login(client, "avatar-invalid@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    response = client.post(
        "/me/avatar",
        headers=auth,
        files={"image": ("avatar.gif", b"gif-bytes", "image/gif")},
    )
    assert response.status_code == 400
    assert "Only JPEG, PNG, and WEBP images are allowed" in response.json()["detail"]


def test_avatar_upload_rejects_oversized_file(client):
    token = register_and_login(client, "avatar-oversize@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    response = client.post(
        "/me/avatar",
        headers=auth,
        files={"image": ("avatar.jpg", b"x" * (5 * 1024 * 1024 + 1), "image/jpeg")},
    )
    assert response.status_code == 413
    assert response.json()["detail"] == "Image exceeds max upload size"


def test_avatar_upload_requires_auth(client):
    response = client.post(
        "/me/avatar",
        files={"image": ("avatar.jpg", b"jpeg-bytes", "image/jpeg")},
    )
    assert response.status_code == 401
