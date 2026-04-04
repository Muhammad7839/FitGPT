# FitGPT

## Overview
FitGPT is a digital wardrobe and outfit recommendation project with a FastAPI backend that powers authentication, clothing inventory, weather-aware outfit recommendations, and AI-assisted styling flows.

This repository includes Android, web, and backend code, but this README documents the backend finalization state on `backend-features` (Sprint 1 through Sprint 5).
The backend acts as the single source of truth for both Android and web clients.

## Architecture
The backend follows a layered, production-oriented structure:

- `backend/app/main.py`: FastAPI app bootstrap, middleware, router wiring, static uploads mount.
- `backend/app/routes.py`: HTTP routes, request orchestration, response shaping, contract guards.
- `backend/app/crud.py`: data-access and recommendation support operations.
- `backend/app/models.py`: SQLAlchemy ORM models for users, wardrobe, recommendation memory, feedback, and outfit lifecycle entities.
- `backend/app/schemas.py`: Pydantic request/response contracts.
- `backend/app/auth.py`: JWT auth helpers and current-user dependency.
- `backend/app/weather.py`: OpenWeather integration, caching, and normalized weather snapshots.
- `backend/app/ai/*`: deterministic recommender, AI provider integration (Groq), parsing, prompts, and orchestration service.
- `backend/tests/*`: integration and behavior tests (current suite: 110 passing tests).

## Features
### Core (Sprints 1-4)
- JWT auth with register/login and compatibility aliases (`/auth/*`).
- Profile endpoints and onboarding completion flow.
- Wardrobe CRUD (single and bulk), favorites, archive/delete, and image upload.
- Recommendation engine with weather context and explainable outputs.
- Outfit lifecycle support:
  - history (create/list/update/delete)
  - saved outfits (create/list/delete)
  - planned outfits (create/list/assign/delete)
- Recommendation feedback ingestion and weighting signals.
- Rejected outfit memory to avoid repeated unwanted combinations.
- Confidence score alias and recommendation options endpoint.

### Sprint 5 additions
- Forecast-aware recommendations (`/recommendations/forecast`).
- AURA chat and AI recommendation endpoints (`/ai/chat`, `/chat`, `/ai/recommendations`, `/recommendations/ai`).
- Personalization-oriented wardrobe insights:
  - wardrobe gaps
  - underused alerts
  - duplicate detection
- Trip packing list planning (`/plans/packing-list`).
- Tag suggestion generation and apply flow.
- Recommendation interaction tracking for long-term personalization.

## API Overview
Key endpoint groups:

- Auth and account
  - `POST /register`, `POST /login`
  - `POST /auth/register`, `POST /auth/login`
  - `POST /login/google`, `POST /auth/google/callback`
  - `GET /me`, `PUT /me/profile`, `GET /me/summary`
- Wardrobe
  - `POST /wardrobe/items`, `GET /wardrobe/items`, `PUT /wardrobe/items/{item_id}`, `DELETE /wardrobe/items/{item_id}`
  - `POST /wardrobe/items/bulk`, `POST /wardrobe/items/{item_id}/favorite`
  - `GET /wardrobe/gaps`, `GET /wardrobe/underused-alerts`, `GET /wardrobe/duplicates`
- Recommendations and weather
  - `GET /weather/current`, `GET /dashboard/context`
  - `GET /recommendations`, `GET /recommendations/options`, `GET /recommendations/forecast`
  - `POST /recommendations/reject`, `POST /recommendations/feedback`, `POST /recommendations/interactions`
- AI
  - `POST /ai/chat`, `POST /chat`
  - `POST /ai/recommendations`, `POST /recommendations/ai`
- Outfits and planning
  - `POST/GET/PUT/DELETE /outfits/history...`
  - `POST/GET/DELETE /outfits/saved...`
  - `POST/GET/DELETE /outfits/planned...`
  - `POST /plans/packing-list`

## Tech Stack
- Python 3.9+
- FastAPI
- SQLAlchemy
- Pydantic v2
- JWT (`python-jose`)
- Password hashing (`passlib` + `bcrypt`)
- Requests (OpenWeather + provider HTTP)
- Pytest + FastAPI TestClient
- SQLite by default (`fitgpt.db` / `fitgpt_test.db`)

## Engineering Decisions
- Kept API contracts stable while improving failure handling on edge paths.
- Prioritized deterministic recommendation fallback so AI/provider outages do not block core recommendation behavior.
- Centralized schema validation in Pydantic and DB interactions in CRUD to reduce route complexity.
- Preserved compatibility aliases (`/auth/*`, legacy outfit routes) for existing clients.
- Added focused tests for medium-risk reliability paths instead of broad refactors.

## Real Challenges During Finalization
- Branch discipline: changes were finalized strictly on `backend-features` while keeping `main` and `dieuni` untouched.
- Merge friction risk: route-heavy backend development can cause conflicts, especially around shared compatibility endpoints.
- Personalization overlap: recommendation memory, feedback weighting, and rejected outfit filtering touch the same scoring surface and required careful, minimal hardening.
- External dependency reliability: weather/provider payload quality can vary, so error-path normalization was essential to prevent avoidable 500s.

## How To Run
### 1) Backend setup
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2) Environment
Create `backend/.env` (or export env vars) with at least:

```env
SECRET_KEY=change-me
DATABASE_URL=sqlite:///./fitgpt.db
OPENWEATHER_API_KEY=your-openweather-key
GROQ_API_KEY=your-groq-key
```

Optional runtime tuning:
- `OPENWEATHER_TIMEOUT_SECONDS`
- `OPENWEATHER_FORECAST_CACHE_SECONDS`
- `AI_TIMEOUT_SECONDS`
- `GROQ_MODEL`

### 3) Run API
```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 4) Run test suite
```bash
cd backend
pytest -q
```

### 5) Basic validation gate used in finalization
```bash
python3 -m compileall backend/app
pytest -q
```

## Future Improvements
- Introduce migration tooling (Alembic) instead of runtime additive schema checks.
- Add contract tests for more compatibility aliases and cross-client payload parity.
- Expand weather fallback observability (structured logs + metrics for provider failure categories).
- Tighten recommendation ranking usage for optional fields like `time_context` and `plan_date` in options endpoint logic.
- Add load/performance profiling for recommendation-heavy routes.
