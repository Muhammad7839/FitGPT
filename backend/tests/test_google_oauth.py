from app.google_oauth import GoogleTokenValidationError, verify_google_id_token


def test_verify_google_id_token_rejects_invalid_issuer(monkeypatch):
    monkeypatch.setattr("app.google_oauth.GOOGLE_CLIENT_ID", "expected-client-id")
    monkeypatch.setattr(
        "app.google_oauth.id_token.verify_oauth2_token",
        lambda *_args, **_kwargs: {
            "aud": "expected-client-id",
            "iss": "https://malicious.example.com",
            "email": "issuer@example.com",
            "email_verified": True,
        },
    )

    try:
        verify_google_id_token("fake-token")
        assert False, "Expected invalid issuer error"
    except GoogleTokenValidationError as exc:
        assert exc.category == "invalid_issuer"
        assert str(exc) == "Invalid Google token issuer"


def test_verify_google_id_token_rejects_invalid_audience(monkeypatch):
    monkeypatch.setattr("app.google_oauth.GOOGLE_CLIENT_ID", "expected-client-id")
    monkeypatch.setattr(
        "app.google_oauth.id_token.verify_oauth2_token",
        lambda *_args, **_kwargs: {
            "aud": "wrong-client-id",
            "iss": "https://accounts.google.com",
            "email": "audience@example.com",
            "email_verified": True,
        },
    )

    try:
        verify_google_id_token("fake-token")
        assert False, "Expected invalid audience error"
    except GoogleTokenValidationError as exc:
        assert exc.category == "invalid_audience"
        assert str(exc) == "Invalid Google token audience"
