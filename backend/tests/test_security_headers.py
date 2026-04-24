"""Ensure security-hardening middleware and CORS allowlist stay in place."""

from fastapi.testclient import TestClient


def test_security_headers_present_on_root(client: TestClient) -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-Frame-Options") == "DENY"
    assert response.headers.get("Referrer-Policy") == "no-referrer"


def test_security_headers_present_on_health(client: TestClient) -> None:
    response = client.get("/health")

    # /health returns 200 or 503 depending on DB probe; either way it must carry the headers.
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-Frame-Options") == "DENY"
    assert response.headers.get("Referrer-Policy") == "no-referrer"


def test_security_headers_on_error_response(client: TestClient) -> None:
    # 401 responses from auth-required endpoints must still carry the headers.
    response = client.get("/me")

    assert response.status_code == 401
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-Frame-Options") == "DENY"
    assert response.headers.get("Referrer-Policy") == "no-referrer"


def test_cors_preflight_uses_explicit_method_list(client: TestClient) -> None:
    response = client.options(
        "/me",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "Authorization",
        },
    )

    assert response.status_code == 200
    allowed_methods = response.headers.get("access-control-allow-methods", "")
    # The middleware should echo the configured explicit list, never a wildcard.
    assert "*" not in allowed_methods
    for method in ("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"):
        assert method in allowed_methods

    allowed_headers = response.headers.get("access-control-allow-headers", "")
    assert "*" not in allowed_headers
    assert "Authorization" in allowed_headers


def test_cors_rejects_disallowed_origin(client: TestClient) -> None:
    response = client.options(
        "/me",
        headers={
            "Origin": "https://evil.example.com",
            "Access-Control-Request-Method": "GET",
        },
    )

    # A disallowed origin must not be echoed back as Access-Control-Allow-Origin.
    assert response.headers.get("access-control-allow-origin") != "https://evil.example.com"
