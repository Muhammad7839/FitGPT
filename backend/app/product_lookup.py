"""Resolve a scanned barcode/QR value into product metadata.

Given a raw scan (URL from a QR code, or a UPC/EAN number), this module tries to
return a best-effort ``{name, image_url, description}`` so the wardrobe upload
form can be pre-filled. URL resolution pulls OpenGraph tags; bare UPCs are
returned as-is (no third-party DB in this MVP).

Hardened against SSRF: fetched URLs must be public http(s) — private ranges,
link-local, and loopback are blocked.
"""

from __future__ import annotations

import base64
import ipaddress
import logging
import re
import socket
from dataclasses import dataclass
from html import unescape
from typing import Optional
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

_MAX_HTML_BYTES = 512 * 1024
_MAX_IMAGE_BYTES = 2 * 1024 * 1024
_FETCH_TIMEOUT_SECONDS = 5.0
_USER_AGENT = "FitGPT-ProductLookup/1.0 (+https://fitgpt.tech)"

_URL_PATTERN = re.compile(r"^https?://", re.IGNORECASE)
_OG_META_PATTERN = re.compile(
    r"""<meta\b[^>]*?\bproperty\s*=\s*["']og:([a-zA-Z_:]+)["'][^>]*?\bcontent\s*=\s*["']([^"']*)["'][^>]*>""",
    re.IGNORECASE | re.DOTALL,
)
_OG_META_REVERSE_PATTERN = re.compile(
    r"""<meta\b[^>]*?\bcontent\s*=\s*["']([^"']*)["'][^>]*?\bproperty\s*=\s*["']og:([a-zA-Z_:]+)["'][^>]*>""",
    re.IGNORECASE | re.DOTALL,
)
_TITLE_PATTERN = re.compile(r"<title[^>]*>([^<]*)</title>", re.IGNORECASE | re.DOTALL)


@dataclass
class ProductLookupResult:
    code: str
    name: Optional[str] = None
    image_url: Optional[str] = None
    description: Optional[str] = None
    source: str = "unknown"


def _is_public_host(host: str) -> bool:
    """Reject loopback, private, link-local, and multicast addresses."""
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        return False
    for info in infos:
        addr = info[4][0]
        try:
            ip = ipaddress.ip_address(addr)
        except ValueError:
            return False
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved:
            return False
    return True


def _safe_url(raw: str) -> Optional[str]:
    try:
        parsed = urlparse(raw.strip())
    except ValueError:
        return None
    if parsed.scheme not in {"http", "https"}:
        return None
    if not parsed.hostname:
        return None
    if not _is_public_host(parsed.hostname):
        return None
    return parsed.geturl()


def _parse_og_tags(html: str) -> dict[str, str]:
    tags: dict[str, str] = {}
    for match in _OG_META_PATTERN.finditer(html):
        prop, content = match.group(1), match.group(2)
        tags.setdefault(prop.lower(), unescape(content).strip())
    for match in _OG_META_REVERSE_PATTERN.finditer(html):
        content, prop = match.group(1), match.group(2)
        tags.setdefault(prop.lower(), unescape(content).strip())
    return tags


def _parse_title(html: str) -> Optional[str]:
    match = _TITLE_PATTERN.search(html)
    if not match:
        return None
    return unescape(match.group(1)).strip() or None


def _read_capped(response: httpx.Response, cap: int) -> bytes:
    buffer = bytearray()
    for chunk in response.iter_bytes():
        buffer.extend(chunk)
        if len(buffer) > cap:
            return bytes(buffer[:cap])
    return bytes(buffer)


def _fetch_image_as_data_url(client: httpx.Client, image_url: str) -> Optional[str]:
    safe = _safe_url(image_url)
    if not safe:
        return None
    try:
        with client.stream("GET", safe, timeout=_FETCH_TIMEOUT_SECONDS) as response:
            if response.status_code != 200:
                return None
            content_type = (response.headers.get("content-type") or "").split(";", 1)[0].strip().lower()
            if not content_type.startswith("image/"):
                return None
            data = _read_capped(response, _MAX_IMAGE_BYTES)
    except httpx.HTTPError as exc:
        logger.info("Image fetch failed for %s: %s", safe, exc)
        return None
    if not data:
        return None
    encoded = base64.b64encode(data).decode("ascii")
    return f"data:{content_type};base64,{encoded}"


def _lookup_url(url: str) -> Optional[ProductLookupResult]:
    safe = _safe_url(url)
    if not safe:
        return None
    headers = {"User-Agent": _USER_AGENT, "Accept": "text/html,*/*;q=0.5"}
    try:
        with httpx.Client(follow_redirects=True, headers=headers) as client:
            with client.stream("GET", safe, timeout=_FETCH_TIMEOUT_SECONDS) as response:
                if response.status_code != 200:
                    logger.info("URL lookup non-200 for %s: %s", safe, response.status_code)
                    return None
                content_type = (response.headers.get("content-type") or "").lower()
                if "html" not in content_type and "text" not in content_type:
                    return None
                body = _read_capped(response, _MAX_HTML_BYTES)
            try:
                html = body.decode("utf-8", errors="replace")
            except Exception:  # noqa: BLE001
                html = body.decode("latin-1", errors="replace")

            og = _parse_og_tags(html)
            name = og.get("title") or _parse_title(html)
            description = og.get("description")
            raw_image = og.get("image")
            image_data_url = _fetch_image_as_data_url(client, raw_image) if raw_image else None
    except httpx.HTTPError as exc:
        logger.info("URL lookup failed for %s: %s", safe, exc)
        return None

    if not any((name, description, image_data_url)):
        return None

    return ProductLookupResult(
        code=url,
        name=name,
        image_url=image_data_url,
        description=description,
        source="opengraph",
    )


def lookup(code: str) -> ProductLookupResult:
    """Resolve a scanned code. Never raises — always returns a result."""
    stripped = (code or "").strip()
    if not stripped:
        return ProductLookupResult(code="", source="empty")

    if _URL_PATTERN.match(stripped):
        resolved = _lookup_url(stripped)
        if resolved is not None:
            return resolved
        return ProductLookupResult(code=stripped, source="url_unresolved")

    return ProductLookupResult(code=stripped, source="raw")
