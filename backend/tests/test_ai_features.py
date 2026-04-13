"""AI endpoint integration tests for chat and recommendation fallback behavior."""

from app.ai.provider import AiProviderError
from app.weather import WeatherLookupError, WeatherSnapshot
from conftest import register_and_login


def _create_item(client, auth, *, category: str, color: str, name: str, clothing_type: str):
    response = client.post(
        "/wardrobe/items",
        headers=auth,
        json={
            "name": name,
            "category": category,
            "clothing_type": clothing_type,
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
        },
    )
    assert response.status_code == 200
    return response.json()


def _outfit_signature(outfit: dict) -> str:
    item_ids = sorted(entry["id"] for entry in outfit["items"])
    return ",".join(str(item_id) for item_id in item_ids)


def test_ai_chat_allows_guest_context(client, monkeypatch):
    class FakeProvider:
        is_available = False

    monkeypatch.setattr("app.routes.ai_service.provider_client", FakeProvider())
    response = client.post(
        "/ai/chat",
        json={"messages": [{"role": "user", "content": "help me pick an outfit"}]},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "fallback"
    assert body["fallback_used"] is True


def test_chat_alias_allows_guest_context(client, monkeypatch):
    class FakeProvider:
        is_available = False

    monkeypatch.setattr("app.routes.ai_service.provider_client", FakeProvider())
    response = client.post(
        "/chat",
        json={"messages": [{"role": "user", "content": "help me pick an outfit"}]},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "fallback"
    assert body["fallback_used"] is True


def test_ai_chat_rejects_empty_messages(client):
    response = client.post("/ai/chat", json={"messages": []})
    assert response.status_code == 422


def test_ai_chat_rejects_blank_content(client):
    response = client.post(
        "/ai/chat",
        json={"messages": [{"role": "user", "content": "   "}]},
    )
    assert response.status_code == 422


def test_ai_chat_success(client, monkeypatch):
    token = register_and_login(client, "ai-chat-success@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    class FakeProvider:
        is_available = True

        @staticmethod
        def chat(messages):
            assert any(message.role == "user" for message in messages)
            return "Try a neutral top with a matching shoe tone."

    monkeypatch.setattr("app.routes.ai_service.provider_client", FakeProvider())
    response = client.post(
        "/ai/chat",
        headers=auth,
        json={"messages": [{"role": "user", "content": "what should i wear for office?"}]},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "ai"
    assert body["fallback_used"] is False
    assert "neutral top" in body["reply"].lower()


def test_ai_chat_system_prompt_uses_continuity_and_wardrobe_context(client, monkeypatch):
    token = register_and_login(client, "ai-chat-context@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}
    _create_item(client, auth, category="Top", color="Black", name="Black Tee", clothing_type="tee")
    _create_item(client, auth, category="Outerwear", color="Olive", name="Olive Jacket", clothing_type="jacket")

    captured = {}

    class FakeProvider:
        is_available = True

        @staticmethod
        def chat(messages):
            captured["messages"] = messages
            return "I’d keep the black tee and bring in the olive jacket for structure."

    monkeypatch.setattr("app.routes.ai_service.provider_client", FakeProvider())
    response = client.post(
        "/ai/chat",
        headers=auth,
        json={
            "messages": [
                {"role": "user", "content": "I want something casual tonight"},
                {"role": "assistant", "content": "Got it, do you want layers?"},
                {"role": "user", "content": "Yes, but not too heavy"},
            ]
        },
    )
    assert response.status_code == 200
    system_prompt = captured["messages"][0].content
    assert "use prior turns in the conversation" in system_prompt.lower()
    assert "wardrobe summary:" in system_prompt.lower()
    assert "outerwear" in system_prompt.lower()
    assert "high-taste personal stylist" in system_prompt.lower()
    assert "shape, balance, contrast, proportion" in system_prompt.lower()
    assert "overly fancy fashion-editor language" in system_prompt.lower()
    assert "what should i wear" in system_prompt.lower()
    assert "going outside" in system_prompt.lower()


def test_ai_chat_fallback_when_provider_unavailable(client, monkeypatch):
    token = register_and_login(client, "ai-chat-fallback@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    class FakeProvider:
        is_available = False

    monkeypatch.setattr("app.routes.ai_service.provider_client", FakeProvider())
    response = client.post(
        "/ai/chat",
        headers=auth,
        json={"messages": [{"role": "user", "content": "hello"}]},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "fallback"
    assert body["fallback_used"] is True
    assert body["warning"] == "provider_not_configured"


def test_ai_chat_fallback_greets_user_naturally(client, monkeypatch):
    class FakeProvider:
        is_available = False

    monkeypatch.setattr("app.routes.ai_service.provider_client", FakeProvider())
    response = client.post(
        "/ai/chat",
        json={"messages": [{"role": "user", "content": "hi"}]},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["fallback_used"] is True
    assert "hi" in body["reply"].lower()
    assert "aura" in body["reply"].lower()
    assert "want me to build a quick outfit" in body["reply"].lower()


def test_ai_chat_fallback_redirects_non_style_requests(client, monkeypatch):
    class FakeProvider:
        is_available = False

    monkeypatch.setattr("app.routes.ai_service.provider_client", FakeProvider())
    response = client.post(
        "/ai/chat",
        json={"messages": [{"role": "user", "content": "I want to eat"}]},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["fallback_used"] is True
    assert "i can help with that" in body["reply"].lower()
    assert "want me" in body["reply"].lower()
    assert "?" in body["reply"]


def test_ai_chat_fallback_builds_on_previous_turn_with_wardrobe_context(client, monkeypatch):
    token = register_and_login(client, "ai-chat-follow-up@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}
    _create_item(client, auth, category="Top", color="Black", name="Black Tee", clothing_type="tee")
    _create_item(client, auth, category="Bottom", color="Blue", name="Blue Jeans", clothing_type="jeans")
    _create_item(client, auth, category="Outerwear", color="Olive", name="Olive Jacket", clothing_type="jacket")

    class FakeProvider:
        is_available = False

    monkeypatch.setattr("app.routes.ai_service.provider_client", FakeProvider())
    response = client.post(
        "/ai/chat",
        headers=auth,
        json={
            "messages": [
                {"role": "user", "content": "I want something casual tonight"},
                {"role": "assistant", "content": "Do you want layers?"},
                {"role": "user", "content": "Yes, but not too heavy"},
            ]
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["fallback_used"] is True
    assert "keeping it casual" in body["reply"].lower()
    assert "wardrobe" in body["reply"].lower() or "items" in body["reply"].lower()
    assert "want me" in body["reply"].lower()


def test_ai_chat_fallback_varies_tone_for_repeated_same_input(client, monkeypatch):
    token = register_and_login(client, "ai-chat-variation@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}
    _create_item(client, auth, category="Top", color="White", name="White Tee", clothing_type="tee")
    _create_item(client, auth, category="Bottom", color="Olive", name="Olive Chino", clothing_type="chino")
    _create_item(client, auth, category="Shoes", color="White", name="White Sneakers", clothing_type="sneakers")

    class FakeProvider:
        is_available = False

    monkeypatch.setattr("app.routes.ai_service.provider_client", FakeProvider())

    replies = []
    message_sets = [
        [{"role": "user", "content": "what should i wear"}],
        [
            {"role": "user", "content": "what should i wear"},
            {"role": "assistant", "content": "Sure, I can build from that."},
            {"role": "user", "content": "what should i wear"},
        ],
        [
            {"role": "user", "content": "what should i wear"},
            {"role": "assistant", "content": "Sure, I can build from that."},
            {"role": "user", "content": "what should i wear"},
            {"role": "assistant", "content": "Do you want it cleaner or more relaxed?"},
            {"role": "user", "content": "what should i wear"},
        ],
    ]

    for messages in message_sets:
        response = client.post("/ai/chat", headers=auth, json={"messages": messages})
        assert response.status_code == 200
        body = response.json()
        assert body["fallback_used"] is True
        assert "?" in body["reply"]
        replies.append(body["reply"])

    assert len(set(replies)) == 3
    assert any("honestly" in reply.lower() for reply in replies)


def test_chat_alias_uses_same_response_contract(client, monkeypatch):
    token = register_and_login(client, "ai-chat-alias@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    class FakeProvider:
        is_available = True

        @staticmethod
        def chat(messages):
            assert any(message.role == "user" for message in messages)
            return "Alias endpoint is working."

    monkeypatch.setattr("app.routes.ai_service.provider_client", FakeProvider())
    response = client.post(
        "/chat",
        headers=auth,
        json={"messages": [{"role": "user", "content": "is alias active?"}]},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "ai"
    assert body["fallback_used"] is False
    assert "alias endpoint" in body["reply"].lower()


def test_ai_recommendations_ai_success(client, monkeypatch):
    token = register_and_login(client, "ai-reco-success@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    top = _create_item(client, auth, category="Top", color="Black", name="Black Tee", clothing_type="tee")
    bottom = _create_item(client, auth, category="Bottom", color="Blue", name="Blue Jeans", clothing_type="jeans")
    shoes = _create_item(client, auth, category="Shoes", color="White", name="White Sneakers", clothing_type="sneakers")

    class FakeProvider:
        is_available = True

        @staticmethod
        def chat(_messages):
            return (
                '{"item_ids":['
                f'{top["id"]},{bottom["id"]},{shoes["id"]}'
                '],"explanation":"Balanced casual outfit.","item_explanations":{"'
                f'{top["id"]}'
                '":"Neutral base","'
                f'{bottom["id"]}'
                '":"Adds depth"}}'
            )

    monkeypatch.setattr("app.routes.ai_service.provider_client", FakeProvider())
    response = client.post(
        "/ai/recommendations",
        headers=auth,
        json={"weather_category": "mild", "occasion": "office"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "ai"
    assert body["fallback_used"] is False
    assert len(body["items"]) >= 3
    assert body["suggestion_id"]
    assert "office" in body["explanation"].lower()
    assert "color" in body["explanation"].lower()


def test_ai_recommendations_malformed_provider_payload_fallback(client, monkeypatch):
    token = register_and_login(client, "ai-reco-malformed@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    _create_item(client, auth, category="Top", color="Black", name="Black Tee", clothing_type="tee")
    _create_item(client, auth, category="Bottom", color="Blue", name="Blue Jeans", clothing_type="jeans")
    _create_item(client, auth, category="Shoes", color="White", name="White Sneakers", clothing_type="sneakers")

    class FakeProvider:
        is_available = True

        @staticmethod
        def chat(_messages):
            return "not-valid-json"

    monkeypatch.setattr("app.routes.ai_service.provider_client", FakeProvider())
    response = client.post("/ai/recommendations", headers=auth, json={"weather_category": "mild"})
    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "fallback"
    assert body["fallback_used"] is True
    assert body["warning"] == "provider_malformed_response"
    assert len(body["items"]) >= 3


def test_ai_recommendations_provider_error_fallback(client, monkeypatch):
    token = register_and_login(client, "ai-reco-provider-error@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    _create_item(client, auth, category="Top", color="Black", name="Black Tee", clothing_type="tee")
    _create_item(client, auth, category="Bottom", color="Blue", name="Blue Jeans", clothing_type="jeans")
    _create_item(client, auth, category="Shoes", color="White", name="White Sneakers", clothing_type="sneakers")

    class FakeProvider:
        is_available = True

        @staticmethod
        def chat(_messages):
            raise AiProviderError("provider_rate_limited", "rate limit", status_code=503, retryable=True)

    monkeypatch.setattr("app.routes.ai_service.provider_client", FakeProvider())
    response = client.post("/ai/recommendations", headers=auth, json={"weather_category": "mild"})
    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "fallback"
    assert body["warning"] == "provider_rate_limited"


def test_ai_recommendations_fall_back_when_weather_lookup_fails_without_weather_category(client, monkeypatch):
    token = register_and_login(client, "ai-reco-weather-fallback@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    _create_item(client, auth, category="Top", color="Black", name="Black Tee", clothing_type="tee")
    _create_item(client, auth, category="Bottom", color="Blue", name="Blue Jeans", clothing_type="jeans")
    _create_item(client, auth, category="Shoes", color="White", name="White Sneakers", clothing_type="sneakers")

    class FakeProvider:
        is_available = False

    def fail_lookup(*_args, **_kwargs):
        raise WeatherLookupError("service unavailable", status_code=503)

    monkeypatch.setattr("app.routes.ai_service.provider_client", FakeProvider())
    monkeypatch.setattr("app.routes.fetch_current_temperature_f", fail_lookup)
    monkeypatch.setattr("app.routes.fetch_current_weather", fail_lookup)

    response = client.post(
        "/ai/recommendations",
        headers=auth,
        json={"weather_city": "Boston"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["weather_category"] == "mild"
    assert body["weather_available"] is False
    assert len(body["items"]) >= 3


def test_ai_recommendations_return_structured_weather_fallback_when_service_not_configured(client, monkeypatch):
    token = register_and_login(client, "ai-reco-weather-config@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    _create_item(client, auth, category="Top", color="Black", name="Black Tee", clothing_type="tee")
    _create_item(client, auth, category="Bottom", color="Blue", name="Blue Jeans", clothing_type="jeans")
    _create_item(client, auth, category="Shoes", color="White", name="White Sneakers", clothing_type="sneakers")

    class FakeProvider:
        is_available = False

    def not_configured(*_args, **_kwargs):
        raise WeatherLookupError("Weather service is not configured", status_code=503)

    monkeypatch.setattr("app.routes.ai_service.provider_client", FakeProvider())
    monkeypatch.setattr("app.routes.fetch_current_temperature_f", not_configured)
    monkeypatch.setattr("app.routes.fetch_current_weather", not_configured)

    response = client.post(
        "/ai/recommendations",
        headers=auth,
        json={"weather_city": "Boston"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["items"]
    assert body["weather_category"] == "mild"
    assert body["weather_available"] is False


def test_ai_recommendations_explanation_uses_weather_time_and_occasion(client, monkeypatch):
    token = register_and_login(client, "ai-reco-context@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    _create_item(client, auth, category="Top", color="White", name="White Linen Shirt", clothing_type="shirt")
    _create_item(client, auth, category="Top", color="Blue", name="Blue Polo", clothing_type="polo")
    _create_item(client, auth, category="Bottom", color="Khaki", name="Khaki Chino", clothing_type="chino")
    _create_item(client, auth, category="Shoes", color="Brown", name="Brown Loafers", clothing_type="loafers")

    class FakeProvider:
        is_available = False

    monkeypatch.setattr("app.routes.ai_service.provider_client", FakeProvider())
    response = client.post(
        "/ai/recommendations",
        headers=auth,
        json={
            "weather_category": "warm",
            "occasion": "office",
            "time_context": "Evening",
        },
    )
    assert response.status_code == 200
    body = response.json()
    explanation = body["explanation"].lower()
    assert body["fallback_used"] is True
    assert "warm" in explanation
    assert "office" in explanation
    assert "evening" in explanation
    assert any(
        phrase in explanation
        for phrase in {
            "color",
            "clean but elevated",
            "slightly styled",
            "colors work well together",
            "color mix stays balanced",
            "color contrast",
            "bit more styled than usual",
            "leans a little more into style",
            "a little extra edge",
            "not the safest combo",
            "gives it more character",
            "slightly past basic",
            "i’d go with this",
            "this would work really well",
            "honestly, this combo just works",
            "this one feels balanced",
            "simple, clean",
        }
    )


def test_ai_recommendations_weak_wardrobe_still_returns_outfit_with_limitation(client, monkeypatch):
    token = register_and_login(client, "ai-reco-weak-wardrobe@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    _create_item(client, auth, category="Top", color="Black", name="Only Tee", clothing_type="tee")
    _create_item(client, auth, category="Bottom", color="Black", name="Only Pants", clothing_type="pants")
    _create_item(client, auth, category="Shoes", color="Black", name="Only Sneakers", clothing_type="sneakers")

    class FakeProvider:
        is_available = False

    monkeypatch.setattr("app.routes.ai_service.provider_client", FakeProvider())
    response = client.post(
        "/ai/recommendations",
        headers=auth,
        json={"weather_category": "mild", "occasion": "daily"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["items"]
    assert "wardrobe" in body["explanation"].lower() or "rotation" in body["explanation"].lower()


def test_recommendations_ai_alias_requires_auth(client):
    response = client.post(
        "/recommendations/ai",
        json={"items": [], "context": {"weather_category": "mild"}},
    )
    assert response.status_code == 401


def test_recommendations_ai_alias_returns_web_compatible_shape(client, monkeypatch):
    token = register_and_login(client, "ai-reco-alias@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    top = _create_item(client, auth, category="Top", color="Black", name="Black Tee", clothing_type="tee")
    bottom = _create_item(client, auth, category="Bottom", color="Blue", name="Blue Jeans", clothing_type="jeans")
    shoes = _create_item(client, auth, category="Shoes", color="White", name="White Sneakers", clothing_type="sneakers")

    class FakeProvider:
        is_available = False

    monkeypatch.setattr("app.routes.ai_service.provider_client", FakeProvider())
    response = client.post(
        "/recommendations/ai",
        headers=auth,
        json={
            "items": [
                {"id": str(top["id"]), "name": top["name"], "category": "top"},
                {"id": str(bottom["id"]), "name": bottom["name"], "category": "bottom"},
                {"id": str(shoes["id"]), "name": shoes["name"], "category": "shoes"},
            ],
            "context": {
                "weather_category": "mild",
                "occasion": "daily",
                "style_preferences": ["casual"],
            },
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "fallback"
    assert body["fallback_used"] is True
    assert isinstance(body["outfits"], list)
    assert body["outfits"]
    assert set(body["outfits"][0]["item_ids"]) == {str(top["id"]), str(bottom["id"]), str(shoes["id"])}


def test_dashboard_context_returns_idle_without_weather_inputs(client):
    token = register_and_login(client, "dashboard-context-idle@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    response = client.get("/dashboard/context", headers=auth)
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "idle"
    assert body["weather"] is None


def test_dashboard_context_returns_weather_when_lookup_succeeds(client, monkeypatch):
    token = register_and_login(client, "dashboard-context-weather@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    monkeypatch.setattr(
        "app.routes.fetch_current_weather",
        lambda **_: WeatherSnapshot(
            city="Boston",
            temperature_f=58,
            weather_category="mild",
            condition="Clouds",
            description="scattered clouds",
        ),
    )
    response = client.get("/dashboard/context?city=Boston", headers=auth)
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "available"
    assert body["weather"]["city"] == "Boston"
    assert body["weather"]["temperature_f"] == 58


def test_dashboard_context_returns_unavailable_on_weather_error(client, monkeypatch):
    token = register_and_login(client, "dashboard-context-error@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    def raise_weather_error(**_):
        raise WeatherLookupError("Weather service authentication failed", status_code=502)

    monkeypatch.setattr("app.routes.fetch_current_weather", raise_weather_error)
    response = client.get("/dashboard/context?city=Boston", headers=auth)
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "unavailable"
    assert body["weather"] is None
    assert body["detail"] == "Weather service authentication failed"


def test_ai_recommendations_repeat_prevention_avoids_same_fingerprint(client, monkeypatch):
    token = register_and_login(client, "ai-reco-repeat@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    _create_item(client, auth, category="Top", color="Black", name="Black Tee", clothing_type="tee")
    _create_item(client, auth, category="Top", color="White", name="White Shirt", clothing_type="shirt")
    _create_item(client, auth, category="Top", color="Olive", name="Olive Overshirt", clothing_type="overshirt")
    _create_item(client, auth, category="Bottom", color="Blue", name="Blue Jeans", clothing_type="jeans")
    _create_item(client, auth, category="Bottom", color="Khaki", name="Khaki Chino", clothing_type="chino")
    _create_item(client, auth, category="Shoes", color="White", name="White Sneakers", clothing_type="sneakers")
    _create_item(client, auth, category="Shoes", color="Black", name="Black Loafers", clothing_type="loafers")

    class FakeProvider:
        is_available = False

    monkeypatch.setattr("app.routes.ai_service.provider_client", FakeProvider())
    first = client.post("/ai/recommendations", headers=auth, json={"weather_category": "mild"})
    second = client.post("/ai/recommendations", headers=auth, json={"weather_category": "mild"})

    assert first.status_code == 200
    assert second.status_code == 200
    first_body = first.json()
    second_body = second.json()
    assert first_body["source"] == "fallback"
    assert second_body["source"] == "fallback"
    assert first_body["suggestion_id"] != second_body["suggestion_id"]
    first_top_ids = {
        item["id"] for item in first_body["items"] if item["category"].strip().lower() == "top"
    }
    second_top_ids = {
        item["id"] for item in second_body["items"] if item["category"].strip().lower() == "top"
    }
    assert first_top_ids
    assert second_top_ids
    assert first_top_ids != second_top_ids


def test_recommendation_feedback_endpoint_upserts_signal(client):
    token = register_and_login(client, "feedback-upsert@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    first = client.post(
        "/recommendations/feedback",
        headers=auth,
        json={"suggestion_id": "1,2,3", "signal": "like"},
    )
    assert first.status_code == 200
    assert first.json()["signal"] == "like"

    second = client.post(
        "/recommendations/feedback",
        headers=auth,
        json={"suggestion_id": "1,2,3", "signal": "reject"},
    )
    assert second.status_code == 200
    second_body = second.json()
    assert second_body["signal"] == "reject"
    assert second_body["suggestion_id"] == "1,2,3"


def test_recommendation_feedback_influences_option_ranking(client, monkeypatch):
    token = register_and_login(client, "feedback-ranking@example.com", "password123")
    auth = {"Authorization": f"Bearer {token}"}

    _create_item(client, auth, category="Top", color="Black", name="Black Tee", clothing_type="tee")
    _create_item(client, auth, category="Top", color="White", name="White Tee", clothing_type="tee")
    _create_item(client, auth, category="Bottom", color="Blue", name="Blue Jeans", clothing_type="jeans")
    _create_item(client, auth, category="Shoes", color="White", name="White Sneakers", clothing_type="sneakers")
    _create_item(client, auth, category="Shoes", color="Black", name="Black Sneakers", clothing_type="sneakers")

    class FakeProvider:
        is_available = False

    monkeypatch.setattr("app.routes.ai_service.provider_client", FakeProvider())

    initial = client.get(
        "/recommendations/options",
        headers=auth,
        params={"weather_category": "mild", "limit": 3},
    )
    assert initial.status_code == 200
    initial_outfits = initial.json()["outfits"]
    assert len(initial_outfits) >= 2
    initial_signature = _outfit_signature(initial_outfits[0])
    initial_item_ids = [entry["id"] for entry in initial_outfits[0]["items"]]

    feedback = client.post(
        "/recommendations/feedback",
        headers=auth,
        json={
            "suggestion_id": initial_signature,
            "signal": "reject",
            "item_ids": initial_item_ids,
        },
    )
    assert feedback.status_code == 200
    assert feedback.json()["signal"] == "reject"

    reranked = client.get(
        "/recommendations/options",
        headers=auth,
        params={"weather_category": "mild", "limit": 3},
    )
    assert reranked.status_code == 200
    reranked_outfits = reranked.json()["outfits"]
    assert len(reranked_outfits) >= 1
    reranked_signature = _outfit_signature(reranked_outfits[0])
    assert reranked_signature != initial_signature
