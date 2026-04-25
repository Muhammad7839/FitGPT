"""Tests for the receipt OCR endpoint and parser module."""

import io
import json
from types import SimpleNamespace
from typing import Optional

from app import receipt_ocr
from conftest import register_and_login


def _fake_response(content: str) -> SimpleNamespace:
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])


class _FakeClient:
    def __init__(self, content: str = "", raise_error: Optional[Exception] = None):
        self._content = content
        self._raise = raise_error
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    def _create(self, **_kwargs):
        if self._raise is not None:
            raise self._raise
        return _fake_response(self._content)


def _png_bytes() -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n"
        b"\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde"
        b"\x00\x00\x00\x0cIDATx\x9cc\xf8\xff\xff?\x00\x05\xfe\x02\xfe\x8a\xd8\x15\x9d"
        b"\x00\x00\x00\x00IEND\xaeB`\x82"
    )


def _upload_fields(content_type: str = "image/png"):
    return {"image": ("receipt.png", _png_bytes(), content_type)}


def test_receipt_ocr_requires_auth(client):
    response = client.post("/receipts/ocr", files=_upload_fields())
    assert response.status_code == 401


def test_receipt_ocr_rejects_non_image(client):
    token = register_and_login(client, "receipt-mime@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}
    response = client.post(
        "/receipts/ocr",
        headers=auth,
        files={"image": ("note.txt", b"plain text", "text/plain")},
    )
    assert response.status_code == 400


def test_receipt_ocr_returns_empty_when_provider_not_configured(client, monkeypatch):
    token = register_and_login(client, "receipt-unconfigured@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    monkeypatch.setattr(receipt_ocr, "_get_vision_client", lambda: None)
    response = client.post("/receipts/ocr", headers=auth, files=_upload_fields())
    assert response.status_code == 200
    body = response.json()
    assert body["items"] == []
    assert body["source"] == "unavailable"
    assert body["warning"] == "provider_not_configured"


def test_receipt_ocr_happy_path_extracts_items(client, monkeypatch):
    token = register_and_login(client, "receipt-happy@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    payload = {
        "items": [
            {"name": "Black Cotton Tee", "category": "Top", "color": "Black", "price": 24.99},
            {"name": "Slim Jeans", "category": "Bottom", "color": "Blue", "price": 59.00},
            {"name": "Leather Sneakers", "category": "Shoes", "color": "White", "price": 89.50},
        ]
    }
    monkeypatch.setattr(receipt_ocr, "_get_vision_client", lambda: _FakeClient(content=json.dumps(payload)))

    response = client.post("/receipts/ocr", headers=auth, files=_upload_fields())
    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "ai"
    assert body["warning"] is None
    assert len(body["items"]) == 3
    names = {item["name"] for item in body["items"]}
    assert names == {"Black Cotton Tee", "Slim Jeans", "Leather Sneakers"}


def test_receipt_ocr_filters_non_clothing_and_normalizes_categories(client, monkeypatch):
    token = register_and_login(client, "receipt-filter@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    payload = {
        "items": [
            {"name": "Loaf of bread", "category": "Food", "price": 3.99},
            {"name": "Wool Scarf", "category": "Accessories", "color": "Grey", "price": 19.00},
            {"name": "", "category": "Top"},
            {"name": "Denim Jacket", "category": "outerwear", "color": "", "price": "45"},
        ]
    }
    monkeypatch.setattr(receipt_ocr, "_get_vision_client", lambda: _FakeClient(content=json.dumps(payload)))

    response = client.post("/receipts/ocr", headers=auth, files=_upload_fields())
    assert response.status_code == 200
    body = response.json()
    assert len(body["items"]) == 2
    mapped = {(item["name"], item["category"]) for item in body["items"]}
    assert ("Wool Scarf", "Accessory") in mapped
    assert ("Denim Jacket", "Outerwear") in mapped


def test_receipt_ocr_malformed_response_returns_warning(client, monkeypatch):
    token = register_and_login(client, "receipt-malformed@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    monkeypatch.setattr(receipt_ocr, "_get_vision_client", lambda: _FakeClient(content="not-json-at-all"))
    response = client.post("/receipts/ocr", headers=auth, files=_upload_fields())
    assert response.status_code == 200
    body = response.json()
    assert body["items"] == []
    assert body["source"] == "error"
    assert body["warning"] == "malformed_response"


def test_receipt_ocr_provider_error_returns_warning(client, monkeypatch):
    token = register_and_login(client, "receipt-provider-err@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}

    monkeypatch.setattr(
        receipt_ocr,
        "_get_vision_client",
        lambda: _FakeClient(raise_error=RuntimeError("boom")),
    )
    response = client.post("/receipts/ocr", headers=auth, files=_upload_fields())
    assert response.status_code == 200
    body = response.json()
    assert body["items"] == []
    assert body["source"] == "error"
    assert body["warning"] == "provider_error"


def test_receipt_ocr_rejects_oversized_image(client, monkeypatch):
    monkeypatch.setattr("app.routes.MAX_UPLOAD_IMAGE_BYTES", 32)
    token = register_and_login(client, "receipt-toobig@example.com", "Testpass9x")
    auth = {"Authorization": f"Bearer {token}"}
    big_bytes = b"\x89PNG\r\n\x1a\n" + b"\x00" * 256
    response = client.post(
        "/receipts/ocr",
        headers=auth,
        files={"image": ("big.png", io.BytesIO(big_bytes), "image/png")},
    )
    assert response.status_code == 413
