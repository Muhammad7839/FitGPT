from app.ai.provider import ProviderMessage
from app.ai.service import AiService


class UnavailableProvider:
    is_available = False


def build_service() -> AiService:
    return AiService(provider_client=UnavailableProvider())


def test_chat_fallback_greeting_stays_warm_and_inviting():
    service = build_service()

    result = service.run_chat(
        user=None,
        wardrobe_items=[],
        messages=[ProviderMessage(role="user", content="hi")],
        request_id="chat-greet",
    )

    assert result.source == "fallback"
    assert "Hi, I’m AURA" in result.reply
    assert "want me to build a quick outfit" in result.reply.lower()


def test_chat_fallback_turns_vague_request_into_follow_up_question():
    service = build_service()

    result = service.run_chat(
        user=None,
        wardrobe_items=[],
        messages=[ProviderMessage(role="user", content="what should I wear")],
        request_id="chat-vague",
    )

    assert result.source == "fallback"
    assert "best at outfit" not in result.reply.lower()
    assert "i’d start" in result.reply.lower() or "i’d keep it simple" in result.reply.lower()
    assert "want me" in result.reply.lower()
    assert "?" in result.reply


def test_chat_fallback_treats_lifestyle_intent_as_recommendation():
    service = build_service()

    result = service.run_chat(
        user=None,
        wardrobe_items=[],
        messages=[ProviderMessage(role="user", content="I’m going outside")],
        request_id="chat-outside",
    )

    assert result.source == "fallback"
    assert "heading outside" in result.reply.lower()
    assert "comfortable shoes" in result.reply.lower() or "weather-ready" in result.reply.lower()
    assert "want me" in result.reply.lower()
    assert "?" in result.reply


def test_chat_fallback_uses_multi_turn_context():
    service = build_service()

    messages = [
        ProviderMessage(role="user", content="I’m going outside"),
        ProviderMessage(role="assistant", content="Where are you headed?"),
        ProviderMessage(role="user", content="Just a walk"),
    ]

    result = service.run_chat(
        user=None,
        wardrobe_items=[],
        messages=messages,
        request_id="chat-multi",
    )

    assert result.source == "fallback"
    assert "outside" in result.reply.lower()
    assert "walk" in result.reply.lower()
    assert "want me" in result.reply.lower()
