"""Integration tests for auth and profile endpoints."""

from app.google_oauth import GoogleTokenValidationError

from conftest import register_and_login


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


def test_google_login_creates_new_user(client, monkeypatch):
    def fake_verify(_: str):
        class Identity:
            email = "google-new@example.com"
            full_name = "Google New"

        return Identity()

    monkeypatch.setattr("app.routes.verify_google_id_token", fake_verify)

    response = client.post("/login/google", json={"id_token": "fake"})
    assert response.status_code == 200
    token = response.json()["access_token"]

    me = client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "google-new@example.com"


def test_google_login_returns_existing_user(client, monkeypatch):
    register_and_login(client, "google-existing@example.com", "password123")

    def fake_verify(_: str):
        class Identity:
            email = "google-existing@example.com"
            full_name = "Existing User"

        return Identity()

    monkeypatch.setattr("app.routes.verify_google_id_token", fake_verify)

    response = client.post("/login/google", json={"id_token": "fake"})
    assert response.status_code == 200
    token = response.json()["access_token"]

    me = client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "google-existing@example.com"


def test_google_login_invalid_or_expired_token_handling(client, monkeypatch):
    def invalid_verify(_: str):
        raise GoogleTokenValidationError("Invalid Google token")

    monkeypatch.setattr("app.routes.verify_google_id_token", invalid_verify)
    invalid_response = client.post("/login/google", json={"id_token": "bad"})
    assert invalid_response.status_code == 400
    assert invalid_response.json()["detail"] == "Invalid Google token"

    def expired_verify(_: str):
        raise GoogleTokenValidationError("Google token has expired", is_expired=True)

    monkeypatch.setattr("app.routes.verify_google_id_token", expired_verify)
    expired_response = client.post("/login/google", json={"id_token": "expired"})
    assert expired_response.status_code == 401
    assert expired_response.json()["detail"] == "Google token has expired"
