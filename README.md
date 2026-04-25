# FitGPT — AI-Powered Outfit Recommendation & Digital Wardrobe

FitGPT is a full-stack application that helps users manage their wardrobe, generate outfit recommendations, and plan what to wear based on real-world context like weather and what's actually in their closet.

The goal was to build something practical and consistent across platforms. Instead of treating web, mobile, and backend as separate systems, the focus was on a single source of truth for data, logic, and user experience.

---

## What this project demonstrates

- Designing and maintaining a shared API contract across web and mobile clients
- A backend that owns business logic instead of duplicating it in clients
- Handling real-world concerns: authentication, environment differences, state consistency, rate limiting, resource cleanup
- Managing multi-branch development and safely unifying divergent codebases
- Delivering a system that works reliably across emulator, physical device, and deployed environments

---

## Core features

### User experience
- Digital wardrobe with add, edit, delete, and bulk upload
- Outfit recommendations driven by what's actually in your closet
- Save outfits for reuse and plan outfits against a calendar
- Outfit history tracking and analytics
- Manual outfit builder with drag-and-drop
- 3D mannequin preview for visualizing outfits
- Receipt OCR — scan a clothing receipt to pre-fill wardrobe items
- Barcode / QR scanner for uploads
- Hands-free voice chat with AURA, the in-app stylist assistant

### Recommendation engine
- Weather-aware (current + multi-day forecast) outfit suggestions
- Layering rules and conflict detection (e.g., two outerwear pieces won't combine)
- Color-theory-aware pairing
- Duplicate clothing detection with similarity scoring
- Trip packing list generation tuned to destination forecast
- Feedback-driven preference learning

### Cross-platform behavior
- Same backend logic used by both web and Android
- Shared authentication and session handling
- Consistent API responses and data models across clients

---

## System architecture

Three parts talking to each other:

- **React web app** (CRA, Three.js, TensorFlow.js, Recharts) — primary interactive surface
- **Android app** (Kotlin + Jetpack Compose, MVVM with `ServiceLocator` DI, Retrofit/OkHttp) — feature-parity client
- **FastAPI backend** (SQLAlchemy, JWT + bcrypt, Google OAuth, OpenWeather, Groq LLM) — the single source of truth

Both clients communicate with the backend via REST.

The backend owns:
- Authentication and session management
- Wardrobe data storage and ownership enforcement
- Recommendation logic, weather lookup, AI chat, receipt OCR
- Outfit saving, planning, and history

All core logic lives in one place so the platforms don't drift.

---

## Production deployment

- **Web:** [www.fitgpt.tech](https://www.fitgpt.tech) — Vercel (React CRA build, `main` branch auto-deploys)
- **Backend:** Render — `https://fitgpt-backend-tdiq.onrender.com` (gunicorn + uvicorn workers, PostgreSQL)
- **Android:** targets the Render backend via `API_BASE_URL` in `gradle.properties`

---

## Tech stack

**Frontend (web):** React 19, React Router 7, JavaScript, CSS, Recharts, Three.js (3D mannequin), TensorFlow.js + MobileNet (on-device classifier).

**Mobile (Android):** Kotlin, Jetpack Compose, Retrofit + OkHttp, Play Services Auth, Coil.

**Backend:** Python 3.12, FastAPI 0.124, SQLAlchemy 2.0, bcrypt + PyJWT 2.12 (auth), pydantic 2, requests 2.33, google-auth.

**Third-party services:** OpenWeather (weather), Groq `llama-3.1-8b-instant` (AURA chat + AI recommendations).

**Tests:** pytest 9.0 (backend, 180+ tests), Jest + React Testing Library (web).

**CI:** GitHub Actions — backend pytest on Python 3.12, web `npm test` + `npm run build` on Node 20.

---

## Key engineering decisions

**Centralized backend logic** — recommendation, validation, and history all live on the server; the clients render.

**API contract stability** — aliased routes (`/login` and `/auth/login`, etc.) preserve compatibility as the frontend evolves.

**Environment-aware networking** — the Android app switches between emulator routing (`10.0.2.2`), LAN access for physical devices, and the production backend based on `BuildConfig` fields.

**Session persistence** — tokens are stored locally and only cleared on true authentication failure, never on a transient network blip.

**Frontend fallback handling** — web mutations support safe fallback behavior with explicit flags so a temporary backend failure does not silently drop user actions.

**Resource hygiene** — outbound HTTP responses are explicitly closed in `finally`; component timers are tracked by a `useManagedTimeouts` hook and cleared on unmount; rate-limit buckets prune stale keys on every write so memory is bounded.

**Security posture** — explicit CORS allowlists (no wildcards), `X-Content-Type-Options` / `X-Frame-Options` / `Referrer-Policy` applied by middleware, sanitized client error messages with full detail in server logs, production-time hard fail if `SECRET_KEY` is still the dev default. Password policy enforced server-side: minimum 8 characters with at least one letter and one number, common passwords rejected. Per-IP rate limiting on login (15 attempts / 15 min) and registration (10 / hour) to limit brute-force and enumeration attacks.

---

## Running the project locally

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Copy `backend/.env.example` to `backend/.env` and fill in what you need (the service boots without every optional key — missing `OPENWEATHER_API_KEY` / `GROQ_API_KEY` / `GOOGLE_CLIENT_ID` log warnings and the affected features gracefully fall back).

### Web

```bash
cd web
npm install
npm start
```

### Android

1. Open the project in Android Studio.
2. Let Gradle sync.
3. Run on an emulator or a physical device.

Notes:
- Emulator hits `10.0.2.2`.
- Physical devices hit your machine's LAN IP (wired up via `API_LAN_BASE_URL` in `gradle.properties`).

---

## Running the tests

### Backend

```bash
cd backend
../.venv/bin/pytest -q
```

Uses an isolated SQLite DB per test (see `backend/tests/conftest.py`). No external network calls — the weather and AI providers are stubbed at the boundary.

### Web

```bash
cd web
CI=true npm test -- --watchAll=false
```

Runs all Jest suites once and exits, matching CI behavior.

### Web production build

```bash
cd web
npm run build
```

---

## Documentation

All docs live in [`docs/`](docs/README.md), split into two folders:

**[`docs/features/`](docs/features/)** — product and feature documentation (start here)

| Doc | Description |
|-----|-------------|
| [system_overview.md](docs/features/system_overview.md) | What FitGPT is and how all the parts connect |
| [architecture.md](docs/features/architecture.md) | Tech stack, system layers, API contract, data flow |
| [authentication.md](docs/features/authentication.md) | Login, Google OAuth, JWT, password reset |
| [api_endpoints.md](docs/features/api_endpoints.md) | All backend REST endpoints |
| [recommendation_engine.md](docs/features/recommendation_engine.md) | Outfit scoring, personalization, and feedback learning |
| [ai_logic.md](docs/features/ai_logic.md) | AURA chatbot, Groq LLM, receipt OCR, image classifier |
| [dashboard.md](docs/features/dashboard.md) | Dashboard, outfit cards, weather context |
| [wardrobe_management.md](docs/features/wardrobe_management.md) | Wardrobe CRUD, uploads, tagging, duplicate detection |
| [outfit_preview.md](docs/features/outfit_preview.md) | 3D mannequin viewer, drag-and-drop outfit builder |
| [planner.md](docs/features/planner.md) | Weekly planner, trip packing, planning calendar |
| [onboarding_personalization.md](docs/features/onboarding_personalization.md) | Onboarding flow and preference settings |
| [user_engagement.md](docs/features/user_engagement.md) | Feedback, wear history, rotation insights |
| [accessibility.md](docs/features/accessibility.md) | High-contrast themes, large text mode |
| [weather_and_time_context.md](docs/features/weather_and_time_context.md) | Weather fetch, normalization, and time-of-day context |

**[`docs/internal/`](docs/internal/)** — team process, audits, and release checklists

| Doc | Description |
|-----|-------------|
| [AUDIT_REPORT.md](docs/internal/AUDIT_REPORT.md) | Full-codebase audit: bugs, security fixes, test gaps |
| [AUDIT_LOG.md](docs/internal/AUDIT_LOG.md) | Step-by-step audit log |
| [features_checklist.md](docs/internal/features_checklist.md) | Feature implementation checklist across all platforms |
| [branch_validation_checklist.md](docs/internal/branch_validation_checklist.md) | Branch hardening and validation commands |
| [branch_comparison_summary.md](docs/internal/branch_comparison_summary.md) | History of branch consolidation |
| [web_android_parity_matrix.md](docs/internal/web_android_parity_matrix.md) | Web vs Android feature parity matrix |
| [android_ux_reliability_hardening.md](docs/internal/android_ux_reliability_hardening.md) | Android-specific UX hardening notes |
| [final_manual_acceptance_script.md](docs/internal/final_manual_acceptance_script.md) | Pre-release manual acceptance test script |

See also: [`AGENTS.md`](AGENTS.md) — working conventions for this repo.

---

## Demo flow

1. Sign in or create an account.
2. Add wardrobe items (manually, via bulk upload, or by scanning a receipt).
3. Generate an outfit recommendation.
4. View the outfit on a 3D mannequin.
5. Build a custom outfit in the drag-and-drop builder.
6. Save or plan the outfit, or ask AURA for a second opinion.

---

## Future work

- Deeper personalization based on long-term usage signals.
- Expanded recommendation logic for nuanced style preferences.
- Component-level integration tests for the largest React screens (see the audit report's follow-up list).
- Android unit tests wired into CI.
- Bundle-size trim by lazy-loading the 3D mannequin + classifier chunks.
