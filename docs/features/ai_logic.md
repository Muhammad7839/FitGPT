# AI Logic

## Overview
FitGPT uses AI to power two distinct features: the AURA conversational chatbot and the AI-assisted outfit recommendation engine. This document covers AURA. Recommendation engine logic is documented in [recommendation_engine.md](recommendation_engine.md).

---

## AURA Chatbot

### Description
AURA is FitGPT's AI chatbot that allows users to ask fashion-related questions and receive personalized outfit advice and styling suggestions through a conversational interface. AURA draws on the user's wardrobe data and saved preferences to provide relevant, personalized responses.

### System Behavior
When a user opens the chatbot and submits a question:
- AURA processes the input and returns a relevant fashion-related response
- Responses are grounded in the user's wardrobe items and preferences where applicable

When a user asks for outfit advice and sufficient user data exists:
- AURA provides personalized recommendations based on the user's wardrobe, preferences, and any context provided in the message

When a user submits unclear or empty input:
- AURA prompts the user for clarification or provides a helpful fallback response
- The chatbot does not fail silently — a response is always returned

### Scope of Advice
AURA can assist with:
- Outfit suggestions for specific occasions, weather, or moods
- Style tips and general fashion guidance
- Questions about color coordination, layering, and item compatibility
- Wardrobe organization suggestions

AURA limits responses to fashion-related topics. Queries outside this scope receive a polite redirect.

### Personalization
When the user is authenticated and has wardrobe data:
- AURA references the user's actual clothing items when making suggestions
- Preferences such as style, comfort, and body type are considered in responses

When wardrobe data is limited or unavailable:
- AURA provides general fashion advice without personalized item references
