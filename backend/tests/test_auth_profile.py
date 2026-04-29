import importlib
from pathlib import Path

import bcrypt

from app.auth import hash_password, verify_password
from app.google_oauth import GoogleTokenValidationError
from sqlalchemy.exc import IntegrityError

from conftest import register_and_login


def _cleanup_uploaded_file(image_url: str):
    filename = image_url.replace("/uploads/", "", 1).strip("/")
    upload_path = Path(__file__).resolve().parents[1] / "uploads" / filename
    try:
        if upload_path.exists():
            upload_path.unlink()
    except OSError:
        # Best-effort cleanup; ignore permission errors in sandboxed environments.
        pass


def test_register_and_login_success(client):
    token = register_and_login(client, "user1@example.com", "Testpass9x")
    assert token


def test_direct_bcrypt_password_helpers_round_trip_and_keep_existing_hash_compatibility():
    password = "Testpass9x"

    hashed = hash_password(password)
    assert hashed.startswith("$2")
    assert verify_password(password, hashed) is True
    assert verify_password("wrong-pass", hashed) is False

    existing_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    assert verify_password(password, existing_hash) is True


def test_auth_alias_register_login_and_me_success(client):
    register = client.post(
        "/auth/register",
        json={"email": "alias-auth@example.com", "password": "Testpass9x"},
    )
    assert register.status_code == 200

    login = client.post(
        "/auth/login",
        json={"email": "alias-auth@example.com", "password": "Testpass9x"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]
    assert token

    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "alias-auth@example.com"


def test_register_returns_400_when_uniqueness_conflict_happens_at_commit(client, monkeypatch):
    monkeypatch.setattr("app.routes.crud.get_user_by_email", lambda *_args, **_kwargs: None)

    def raise_integrity_error(*_args, **_kwargs):
        raise IntegrityError("INSERT INTO users ...", {"email": "race@example.com"}, Exception("UNIQUE constraint failed"))

    monkeypatch.setattr("app.routes.crud.create_user", raise_integrity_error)

    response = client.post(
        "/register",
        json={"email": "race@example.com", "password": "Testpass9x"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Email already registered"


def test_register_rejects_duplicate_email_case_insensitively(client):
    first = client.post(
        "/register",
        json={"email": "MixedCase@Example.com", "password": "Testpass9x"},
    )
    assert first.status_code == 200
    assert first.json()["email"] == "mixedcase@example.com"

    second = client.post(
        "/register",
        json={"email": "mixedcase@example.com", "password": "Testpass9x"},
    )
    assert second.status_code == 400
    assert second.json()["detail"] == "Email already registered"


def test_login_fails_with_wrong_password(client):
    register_and_login(client, "user2@example.com", "Testpass9x")
    bad_login = client.post(
        "/login",
        data={"username": "user2@example.com", "password": "wrong-pass"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert bad_login.status_code == 401


def test_login_is_case_insensitive_and_preserves_wardrobe_after_relogin(client):
    register = client.post(
        "/register",
        json={"email": "WardrobeUser@Example.com", "password": "Testpass9x"},
    )
    assert register.status_code == 200

    first_login = client.post(
        "/login",
        data={"username": "wardrobeuser@example.com", "password": "Testpass9x"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert first_login.status_code == 200
    auth = {"Authorization": f"Bearer {first_login.json()['access_token']}"}

    create = client.post(
        "/wardrobe/items",
        headers=auth,
        json={
            "name": "Persistent Tee",
            "category": "Top",
            "clothing_type": "t-shirt",
            "color": "Black",
            "season": "All",
            "comfort_level": 3,
        },
    )
    assert create.status_code == 200

    relogin = client.post(
        "/login",
        data={"username": "WARDROBEUSER@example.com", "password": "Testpass9x"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert relogin.status_code == 200
    relogin_auth = {"Authorization": f"Bearer {relogin.json()['access_token']}"}

    wardrobe = client.get("/wardrobe/items", headers=relogin_auth)
    assert wardrobe.status_code == 200
    names = [item["name"] for item in wardrobe.json()["items"]]
    assert "Persistent Tee" in names


def test_default_database_url_points_to_backend_db_when_env_is_unset(monkeypatch):
    import app.config as config

    monkeypatch.delenv("DATABASE_URL", raising=False)
    reloaded = importlib.reload(config)
    expected = f"sqlite:///{(Path(config.__file__).resolve().parents[1] / 'fitgpt.db').resolve()}"
    assert reloaded.DATABASE_URL == expected

    monkeypatch.setenv("DATABASE_URL", "sqlite:///./fitgpt_test.db")
    importlib.reload(config)


def test_reset_token_exposure_defaults_to_enabled_in_development(monkeypatch):
    import app.config as config

    monkeypatch.delenv("EXPOSE_RESET_TOKEN_IN_RESPONSE", raising=False)
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    reloaded = importlib.reload(config)
    assert reloaded.EXPOSE_RESET_TOKEN_IN_RESPONSE is True

    monkeypatch.setenv("EXPOSE_RESET_TOKEN_IN_RESPONSE", "false")
    importlib.reload(config)


def test_get_me_and_update_profile(client):
    token = register_and_login(client, "user3@example.com", "Testpass9x")
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
            "style_preferences": ["Professional", "Minimalist"],
            "comfort_preferences": ["Balanced", "Stretchy"],
            "dress_for": ["Work", "Travel"],
            "gender": "woman",
            "height_cm": 170,
            "onboarding_complete": True,
        },
    )
    assert update.status_code == 200
    body = update.json()
    assert body["body_type"] == "athletic"
    assert body["style_preferences"] == ["Professional", "Minimalist"]
    assert body["comfort_preferences"] == ["Balanced", "Stretchy"]
    assert body["dress_for"] == ["Work", "Travel"]
    assert body["gender"] == "woman"
    assert body["height_cm"] == 170
    assert body["onboarding_complete"] is True
    assert body["avatar_url"] is None


def test_onboarding_complete_allows_skipped_preferences(client):
    token = register_and_login(client, "onboarding-skip@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    response = client.post("/onboarding/complete", headers=auth, json={})
    assert response.status_code == 200
    body = response.json()
    assert body["onboarding_complete"] is True
    assert body["body_type"] == "unspecified"
    assert body["lifestyle"] == "casual"
    assert body["comfort_preference"] == "medium"
    assert body["style_preferences"] == []
    assert body["dress_for"] == []
    assert body["gender"] is None
    assert body["height_cm"] is None


def test_weather_current_returns_unavailable_payload_when_provider_is_down(client, monkeypatch):
    token = register_and_login(client, "weather-current-unavailable@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    def fail_lookup(*_args, **_kwargs):
        from app.weather import WeatherLookupError

        raise WeatherLookupError("Weather service is not configured", status_code=503)

    monkeypatch.setattr("app.routes.fetch_current_weather", fail_lookup)

    response = client.get("/weather/current", headers=auth, params={"city": "Boston"})

    assert response.status_code == 200
    body = response.json()
    assert body["city"] == "Boston"
    assert body["available"] is False
    assert body["temperature_f"] is None
    assert body["weather_category"] is None
    assert body["detail"] == "Weather service is not configured"


def test_profile_summary_returns_preferences_and_counts(client):
    token = register_and_login(client, "summary@example.com", "Testpass9x")
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
    assert body["style_preferences"] == []
    assert body["comfort_preferences"] == ["medium"]
    assert body["dress_for"] == []
    assert body["gender"] is None
    assert body["height_cm"] is None
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
    register_and_login(client, "google-existing@example.com", "Testpass9x")

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


def test_google_login_callback_alias_uses_same_flow(client, monkeypatch):
    class Identity:
        email = "google-callback@example.com"
        full_name = "Callback User"

    monkeypatch.setattr("app.routes.verify_google_id_token", lambda _: Identity())

    response = client.post("/auth/google/callback", json={"id_token": "fake-token-value-4444444444"})
    assert response.status_code == 200
    token = response.json()["access_token"]

    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "google-callback@example.com"


def test_google_login_invalid_or_expired_token_handling(client, monkeypatch, caplog):
    caplog.set_level("INFO")

    def invalid_verify(_: str):
        raise GoogleTokenValidationError(
            "Invalid Google token audience",
            category="invalid_audience",
        )

    monkeypatch.setattr("app.routes.verify_google_id_token", invalid_verify)
    invalid_response = client.post("/login/google", json={"id_token": "bad-token-value-2222222222"})
    assert invalid_response.status_code == 400
    # Detail is sanitized to a generic message so internal validator
    # categories never reach the client. Full detail stays in server logs.
    assert invalid_response.json()["detail"] == "Invalid Google credentials."
    assert "category=invalid_audience" in caplog.text
    assert "detail=Invalid Google token audience" in caplog.text

    def expired_verify(_: str):
        raise GoogleTokenValidationError(
            "Google token has expired",
            is_expired=True,
            category="expired_token",
        )

    monkeypatch.setattr("app.routes.verify_google_id_token", expired_verify)
    expired_response = client.post("/login/google", json={"id_token": "expired-token-value-33333333"})
    assert expired_response.status_code == 401
    assert expired_response.json()["detail"] == "Google session expired. Please sign in again."
    assert "category=expired_token" in caplog.text


def test_google_login_missing_token_returns_400_with_explicit_category(client, caplog):
    caplog.set_level("INFO")

    response = client.post("/login/google", json={"id_token": "   "})

    assert response.status_code == 400
    assert response.json()["detail"] == "Google ID token is required"
    assert "category=missing_token" in caplog.text


def test_forgot_and_reset_password_flow(client, monkeypatch):
    monkeypatch.setattr("app.routes.EXPOSE_RESET_TOKEN_IN_RESPONSE", True)
    register_and_login(client, "resetme@example.com", "Testpass9x")

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
        data={"username": "resetme@example.com", "password": "Testpass9x"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert old_login.status_code == 401

    new_login = client.post(
        "/login",
        data={"username": "resetme@example.com", "password": "newpass456"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert new_login.status_code == 200


def test_auth_forgot_and_reset_aliases_match_canonical_behavior(client, monkeypatch):
    monkeypatch.setattr("app.routes.EXPOSE_RESET_TOKEN_IN_RESPONSE", True)
    register_and_login(client, "reset-alias@example.com", "Testpass9x")

    forgot = client.post("/auth/forgot-password", json={"email": "reset-alias@example.com"})
    assert forgot.status_code == 200
    reset_token = forgot.json()["reset_token"]
    assert reset_token

    reset = client.post(
        "/auth/reset-password",
        json={"token": reset_token, "new_password": "newpass456"},
    )
    assert reset.status_code == 200
    assert reset.json()["detail"] == "Password reset successful"

    old_login = client.post(
        "/login",
        data={"username": "reset-alias@example.com", "password": "Testpass9x"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert old_login.status_code == 401

    new_login = client.post(
        "/login",
        data={"username": "reset-alias@example.com", "password": "newpass456"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert new_login.status_code == 200


def test_logout_compat_endpoint_is_stateless(client):
    token = register_and_login(client, "logout-alias@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    without_auth = client.post("/logout")
    assert without_auth.status_code == 200
    assert without_auth.json()["detail"] == "Logged out"

    with_auth = client.post("/logout", headers=auth)
    assert with_auth.status_code == 200
    assert with_auth.json()["detail"] == "Logged out"

    me_after_logout = client.get("/me", headers=auth)
    assert me_after_logout.status_code == 200
    assert me_after_logout.json()["email"] == "logout-alias@example.com"


def test_reset_password_rejects_invalid_token(client):
    response = client.post(
        "/reset-password",
        json={"token": "invalid-token-value-12345", "new_password": "newpass456"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid or expired reset token"


def test_forgot_password_hides_reset_token_when_exposure_disabled(client):
    import app.routes

    app.routes.EXPOSE_RESET_TOKEN_IN_RESPONSE = False
    register_and_login(client, "reset-hidden@example.com", "Testpass9x")

    forgot = client.post("/forgot-password", json={"email": "reset-hidden@example.com"})
    assert forgot.status_code == 200
    body = forgot.json()
    assert body["reset_token"] is None
    assert body["detail"] == "If the account exists, reset instructions were issued"


def test_forgot_password_sends_reset_email_without_exposing_token(client, monkeypatch):
    sent = {}

    def fake_send_password_reset_email(email, token):
        sent["email"] = email
        sent["token"] = token

    monkeypatch.setattr("app.routes.EXPOSE_RESET_TOKEN_IN_RESPONSE", False)
    monkeypatch.setattr("app.routes.send_password_reset_email", fake_send_password_reset_email)
    register_and_login(client, "reset-email@example.com", "Testpass9x")

    forgot = client.post("/forgot-password", json={"email": "reset-email@example.com"})
    assert forgot.status_code == 200
    body = forgot.json()
    assert body["reset_token"] is None
    assert sent["email"] == "reset-email@example.com"
    assert sent["token"]


def test_profile_alias_get_and_put(client):
    token = register_and_login(client, "profile-alias@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    update = client.put(
        "/profile",
        headers=auth,
        json={"body_type": "athletic", "lifestyle": "work", "comfort_preference": "high"},
    )
    assert update.status_code == 200
    assert update.json()["body_type"] == "athletic"
    assert update.json()["lifestyle"] == "work"

    profile = client.get("/profile", headers=auth)
    assert profile.status_code == 200
    body = profile.json()
    assert body["email"] == "profile-alias@example.com"
    assert body["body_type"] == "athletic"
    assert body["lifestyle"] == "work"


def test_avatar_upload_updates_me_and_summary_and_persists_after_relogin(client):
    token = register_and_login(client, "avatar@example.com", "Testpass9x")
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
        data={"username": "avatar@example.com", "password": "Testpass9x"},
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
    token = register_and_login(client, "avatar-invalid@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    response = client.post(
        "/me/avatar",
        headers=auth,
        files={"image": ("avatar.gif", b"gif-bytes", "image/gif")},
    )
    assert response.status_code == 400
    assert "Only JPEG, PNG, and WEBP images are allowed" in response.json()["detail"]


def test_avatar_upload_rejects_oversized_file(client):
    token = register_and_login(client, "avatar-oversize@example.com", "Testpass9x")
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
