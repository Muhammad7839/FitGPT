# System Overview

## What is FitGPT?
FitGPT is an AI-powered wardrobe management and outfit recommendation web app. The goal is to reduce daily decision fatigue by helping users organize their clothing and receive clear, personalized, and explainable outfit suggestions.

Users build a digital wardrobe by uploading photos of their clothing items, tagging them with metadata (color, fit, style, occasion, season, etc.), and letting the system generate outfit combinations tailored to their preferences, body type, and real-world context like weather and time of day.

---

## Core User Journey

```
Sign Up / Log In
       ↓
   Onboarding
   (style, comfort, body type preferences)
       ↓
   Build Wardrobe
   (upload items, add tags, organize)
       ↓
   Get Recommendations
   (scored outfits based on preferences + context)
       ↓
   Plan / Save / Log
   (save favorites, plan the week, log what you wore)
       ↓
   System Learns
   (feedback, history, and usage improve future suggestions)
```

---

## Feature Areas

### Authentication
Users can create accounts with email/password or sign in with Google OAuth. Sessions are persistent via JWT tokens. Guest mode allows exploration without an account, with data migrated on sign-in.

→ See [authentication.md](authentication.md)

---

### Onboarding & Personalization
First-time users complete a short setup flow to define style, comfort, lifestyle, and body type preferences. All steps are optional — defaults are applied for anything skipped. Preferences are editable at any time from the profile page.

→ See [onboarding_personalization.md](onboarding_personalization.md)

---

### Dashboard
The primary landing screen after onboarding. Displays the day's outfit recommendation, weather and time context, and quick navigation to all major features. Users can refresh for alternatives, change the theme, and see why each outfit was recommended.

→ See [dashboard.md](dashboard.md)

---

### Wardrobe Management
Users build a digital wardrobe by uploading clothing items individually or in bulk. Each item is tagged with category, color, fit, style, season, occasion, layer type, and clothing type. Items can be edited, deleted, archived, searched, and filtered. The system detects duplicates, suggests tags automatically, alerts users to underused items, and tracks reuse for laundry planning.

→ See [wardrobe_management.md](wardrobe_management.md)

---

### Recommendation Engine
The core of FitGPT. Generates multiple outfit options scored across color coordination, fit compatibility, style matching, seasonal appropriateness, weather suitability, and outfit history. Each recommendation includes a plain-language explanation. The engine respects logical outfit structure rules, avoids recently worn combinations, limits accessories, handles layering, and supports one-piece and clothing set relationships.

→ See [recommendation_engine.md](recommendation_engine.md)

---

### Weather & Time Context
Recommendations are automatically adjusted based on the user's current weather (detected via geolocation) and time of day. Both can be manually overridden. The system also supports forecast-based outfit suggestions for planning ahead.

→ See [weather_and _time_context.md](weather_and%20_time_context.md)

---

### Planner
A 7-day weekly view where users assign saved outfits to specific days. Quick planning mode reduces the assignment process to a few clicks. Users can also generate packing lists for upcoming trips based on destination weather and trip length.

→ See [planner.md](planner.md)

---

### Saved Outfits, Favorites & History
Users can save and favorite outfit combinations for reuse. Outfit history tracks what was actually worn (user-confirmed), which feeds the recommendation engine's repeat-avoidance logic. History is also viewable in a calendar format.

→ See [wardrobe_management.md](wardrobe_management.md)

---

### AI Features (AURA)
AURA is FitGPT's conversational AI assistant. Users can ask fashion questions, request outfit advice, and get personalized styling suggestions through a chat interface. AURA draws on the user's wardrobe and preferences to give relevant responses.

The backend also uses the Groq API (llama-3.1-8b-instant) to generate AI-powered outfit recommendations as an alternative to the local scoring algorithm.

→ See [ai_logic.md](ai_logic.md)

---

### User Engagement & Feedback
Users can like, dislike, or reject outfit recommendations. Feedback is optional and non-intrusive. The system uses it to adjust recommendation weights over time, progressively improving personalization. Each recommendation also displays a confidence score.

→ See [user_engagement.md](user_engagement.md)

---

### Outfit Preview & Builder
Users can visualize outfits on a 3D mannequin and manually assemble combinations using a drag-and-drop outfit builder. Manually built outfits can be saved through the standard saved outfits flow.

→ See [outfit_preview.md](outfit_preview.md)

---

### Accessibility
FitGPT supports large text mode and high-contrast mode for users who need improved readability or visual clarity. Both settings persist across sessions.

→ See [accessibility.md](accessibility.md)

---

## System Design Principles

**Local-first** — All core features work without a backend. Wardrobe data, saved outfits, history, and plans are stored in browser storage. The backend is a best-effort enhancement, not a dependency.

**Graceful degradation** — Every feature has a fallback. No API failure blocks the user experience. Missing metadata is treated as neutral rather than breaking.

**Explainability** — Every outfit recommendation includes a plain-language explanation. Users always know why something was suggested.

**Non-blocking personalization** — Onboarding steps are optional, feedback is never forced, and default values ensure the system always works regardless of how much data the user provides.

---

## Technical Summary

| Layer | Details |
|---|---|
| Frontend | React 18, React Router v6, localStorage/sessionStorage |
| Backend | FastAPI (Python), SQLite / PostgreSQL |
| AI Recommendations | Groq API (llama-3.1-8b-instant) |
| Weather | Open-Meteo (frontend), OpenWeatherMap (backend) |
| Auth | JWT + Google OAuth |
| Image Classification | TensorFlow.js + MobileNet v2 (auto-tagging) |

→ For full technical detail see [architecture.md](architecture.md) and [api_endpoints.md](api_endpoints.md)
