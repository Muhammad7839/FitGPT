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
