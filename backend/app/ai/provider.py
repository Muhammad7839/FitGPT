"""Groq provider client with normalized errors and timeout-safe behavior."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import requests

from app.config import AI_MAX_TOKENS, AI_TEMPERATURE, AI_TIMEOUT_SECONDS, GROQ_API_KEY, GROQ_MODEL

_GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


class AiProviderError(Exception):
    """Represents provider failures with a stable internal error code."""

    def __init__(
        self,
        code: str,
        message: str,
        *,
        status_code: int = 502,
        retryable: bool = False,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.status_code = status_code
        self.retryable = retryable


@dataclass(frozen=True)
class ProviderMessage:
    """Single chat message passed to the LLM provider."""

    role: str
    content: str


class GroqProviderClient:
    """Backend-only Groq client so Android never receives provider keys."""

    def __init__(
        self,
        *,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        timeout_seconds: Optional[float] = None,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
    ) -> None:
        self.api_key = (api_key if api_key is not None else GROQ_API_KEY).strip()
        self.model = (model if model is not None else GROQ_MODEL).strip()
        self.timeout_seconds = timeout_seconds if timeout_seconds is not None else AI_TIMEOUT_SECONDS
        self.max_tokens = max_tokens if max_tokens is not None else AI_MAX_TOKENS
        self.temperature = temperature if temperature is not None else AI_TEMPERATURE

    @property
    def is_available(self) -> bool:
        return bool(self.api_key)

    def chat(self, messages: list[ProviderMessage]) -> str:
        if not self.is_available:
            raise AiProviderError(
                code="provider_not_configured",
                message="AI provider key is not configured",
                status_code=503,
            )

        payload = {
            "model": self.model,
            "messages": [{"role": message.role, "content": message.content} for message in messages],
            "max_tokens": self.max_tokens,
            "temperature": self.temperature,
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        try:
            response = requests.post(
                _GROQ_URL,
                json=payload,
                headers=headers,
                timeout=self.timeout_seconds,
            )
        except requests.Timeout as exc:
            raise AiProviderError(
                code="provider_timeout",
                message="AI provider timed out",
                status_code=504,
                retryable=True,
            ) from exc
        except requests.RequestException as exc:
            raise AiProviderError(
                code="provider_network_error",
                message="AI provider network error",
                status_code=503,
                retryable=True,
            ) from exc

        try:
            if response.status_code in {401, 403}:
                raise AiProviderError(
                    code="provider_auth_failed",
                    message="AI provider authentication failed",
                    status_code=502,
                )
            if response.status_code == 429:
                raise AiProviderError(
                    code="provider_rate_limited",
                    message="AI provider rate limit exceeded",
                    status_code=503,
                    retryable=True,
                )
            if response.status_code >= 500:
                raise AiProviderError(
                    code="provider_unavailable",
                    message="AI provider unavailable",
                    status_code=503,
                    retryable=True,
                )
            if not response.ok:
                raise AiProviderError(
                    code="provider_request_failed",
                    message=f"AI provider request failed ({response.status_code})",
                    status_code=502,
                )

            try:
                payload = response.json()
                choices = payload.get("choices", [])
                message_payload = choices[0].get("message", {}) if choices else {}
                content = str(message_payload.get("content", "")).strip()
            except ValueError as exc:
                raise AiProviderError(
                    code="provider_malformed_response",
                    message="AI provider returned malformed JSON",
                    status_code=502,
                ) from exc
        finally:
            close = getattr(response, "close", None)
            if callable(close):
                close()

        if not content:
            raise AiProviderError(
                code="provider_empty_response",
                message="AI provider returned an empty response",
                status_code=502,
            )

        return content

