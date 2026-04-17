# Architecture

## Overview
FitGPT is a local-first, offline-capable web app. The frontend handles all core functionality using browser storage and a local recommendation algorithm. The backend extends functionality with persistent accounts, AI recommendations, and weather data — but its absence never breaks the app.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router v6 |
| Backend | FastAPI (Python) |
| Database | SQLite (default), PostgreSQL (via env var) |
| ORM | SQLAlchemy |
| Auth | JWT (email/password), Google OAuth |
| AI Recommendations | Groq API (llama-3.1-8b-instant) |
| Weather | Open-Meteo (frontend, free/no key), OpenWeatherMap (backend) |
| Image Classification | TensorFlow.js + MobileNet v2 |
| 3D Rendering | React Three Fiber + Three.js |
| Charts | recharts |

---

## System Structure

```
FitGPT/
├── web/                    # React frontend (port 3000)
│   └── src/
│       ├── App.js                     # Root: ThemeContext provider
│       ├── routes/AppRoutes.js        # React Router v6 routes
│       ├── auth/
│       │   ├── AuthProvider.js        # AuthContext, getMe() on mount
│       │   └── ProtectedRoute.js
│       ├── components/                # Page and UI components
│       ├── theme/                     # Theme engine and definitions
│       ├── utils/
│       │   ├── userStorage.js         # Per-user storage helpers
│       │   └── classifyClothing.js    # TensorFlow.js auto-categorization
│       └── api/                       # API modules (see api_endpoints.md)
└── backend/                # FastAPI backend (port 8000)
    └── app/
        ├── main.py                    # App setup, CORS, router includes
        ├── routes.py                  # All API endpoints
        ├── models.py                  # SQLAlchemy models
        ├── schemas.py                 # Pydantic request/response models
        ├── crud.py                    # Database operations
        ├── auth.py                    # JWT + Google OAuth helpers
        ├── database.py                # DB engine and session
        ├── weather.py                 # OpenWeatherMap integration
        ├── email.py                   # Gmail SMTP (password reset)
        └── groq_service.py            # Groq AI recommendation service
```

---

## Frontend Architecture

### Routing
React Router v6 with lazy-loaded page components. All routes are client-side.

| Path | Component | Notes |
|---|---|---|
| `/` | Onboarding or redirect | Shows onboarding on first visit, redirects to `/dashboard` if onboarded |
| `/login` | Login | Email/password + Google OAuth |
| `/signup` | Signup | Email/password registration |
| `/forgot-password` | ForgotPassword | Reset request form |
| `/reset-password` | ResetPassword | Token from URL query param |
| `/dashboard` | Dashboard | Main page: recommendations, weather, theme |
| `/wardrobe` | Wardrobe | Upload, edit, delete clothing items |
| `/favorites` | Favorites | View and unfavorite items |
| `/profile` | Profile | Account settings, saved outfits |
| `/history` | HistoryAnalytics | Outfit history + analytics (tabbed) |
| `/plans` | Plans | Planned outfits view |
| `/saved-outfits` | SavedOutfits | Saved outfit combinations |

### Component Tree
```
App
└── ThemeContext.Provider
    └── AuthProvider
        ├── TopNav
        └── AppRoutes (Suspense + ErrorBoundary)
            └── PageTransition
                └── <Page Component>
```

### Auth State
`AuthProvider` calls `getMe()` on mount to restore session from stored JWT. Exposes `user`, `login`, `loginWithGoogle`, `register`, `logout` via `useAuth()`.

### Image Pipeline
Uploaded images are thumbnailed to 200×200 JPEG at 0.7 quality in the browser and stored as base64 data URLs. The TensorFlow.js MobileNet v2 model (~16MB, lazy-loaded and browser-cached) auto-categorizes uploads into one of five clothing categories.

### Recommendation Engine (Client-Side)
`generateThreeOutfits()` in `Dashboard.js` runs a seeded PRNG algorithm that scores combinations by color pairing, fit, weather bias, time bias, and recent outfit frequency. The seed is persisted to sessionStorage so results are reproducible across navigation. If the wardrobe is empty, a default outfit set is shown.

### Theme System
Managed globally via `ThemeContext`. Ten preset themes plus up to five user-created custom themes. `applyTheme()` sets a `data-theme` attribute on `<html>` and injects 23 CSS variables. Classic themes use attribute selectors only; custom and preset themes use inline CSS variables for highest specificity.

---

## Backend Architecture

### API
FastAPI on port 8000. Two routers are registered for compatibility:
- Root router (`/`) — main endpoints
- Auth router (`/auth`) — auth endpoints (same handlers, different prefix)

CORS allows `localhost:3000` and `127.0.0.1:3000`. Additional origins via `CORS_ORIGINS` env var.

### Authentication
- **Email/password**: bcrypt hashing, JWT tokens (60-minute expiration)
- **Google OAuth**: `google-auth` library verifies ID tokens against `GOOGLE_CLIENT_ID`
- **Token storage**: Bearer token in `Authorization` header
- **Multi-auth**: Users can have both email/password and Google linked to the same account

### Database
SQLite by default (`fitgpt.db`). Switch to PostgreSQL by setting `DATABASE_URL`. Tables are created automatically at startup. Column migrations for `google_id` and `auth_provider` run automatically on startup.

### AI Recommendations
`groq_service.py` sends the user's wardrobe items and context to Groq (llama-3.1-8b-instant). The response is validated: hallucinated item IDs are filtered, categories are deduplicated, and outfits with fewer than 2 items are discarded. Returns up to 3 outfits or `None` on failure. The frontend falls back to the local algorithm when `None` is returned.

### Weather
The frontend uses Open-Meteo (free, no API key) via browser geolocation. The backend uses OpenWeatherMap via `OPENWEATHER_API_KEY` for the `/dashboard/context` endpoint. Both fall back gracefully when unavailable.

### Password Reset
`email.py` sends reset links via Gmail SMTP. Requires `GMAIL_ADDRESS`, `GMAIL_APP_PASSWORD`, and `FRONTEND_URL` env vars. Reset tokens expire after 1 hour and are single-use.

---

## Storage Strategy

FitGPT is local-first. All data is stored in browser storage and synced to the backend when available. API failures are caught silently — the local state is always the source of truth.

### Source of Truth
`sessionStorage` key `fitgpt_guest_wardrobe_v1` is the primary wardrobe data store. All wardrobe mutations write here immediately, regardless of auth state. The backend is updated as a best-effort secondary write.

### Per-User Namespacing
When a user is signed in, storage keys are suffixed with their user ID (e.g., `fitgpt_guest_wardrobe_v1_abc123`). Guests use the base key. On login, `migrateGuestData()` copies guest data to the namespaced keys.

### Key Reference

| Key | Storage | Namespaced | Purpose |
|---|---|---|---|
| `fitgpt_guest_wardrobe_v1` | sessionStorage | Yes | Primary wardrobe data |
| `fitgpt_wardrobe_v1` | localStorage | Yes | Legacy fallback (read-only) |
| `fitgpt_saved_outfits_v1` | localStorage | Yes | Saved outfit combinations |
| `fitgpt_planned_outfits_v1` | localStorage | Yes | Planned outfits |
| `fitgpt_outfit_history_v1` | localStorage | Yes | Outfit wear history |
| `fitgpt_profile_v1` | localStorage | Yes | Profile data |
| `fitgpt_profile_pic_v1` | localStorage | Yes | Profile picture (data URL) |
| `fitgpt_onboarding_answers_v1` | localStorage | No | Onboarding answers |
| `fitgpt_onboarded_v1` | localStorage | No | Onboarding completion flag |
| `fitgpt_tutorial_done_v1` | localStorage | No | Guided tutorial flag |
| `fitgpt_theme_v1` | localStorage | No | Active theme ID |
| `fitgpt_custom_themes_v1` | localStorage | No | Custom theme definitions |
| `fitgpt_rec_seed_v1` | sessionStorage | No | Recommendation seed |
| `fitgpt_token_v1` | localStorage | No | JWT auth token |
| `fitgpt_auth_mode_v1` | localStorage | No | Auth mode (email/google/guest) |
| `fitgpt_reuse_outfit_v1` | sessionStorage | No | Outfit reuse from Profile/Plans |

---

## Cross-Component Communication
Custom DOM events are used for communication between components that do not share a direct parent:

| Event | Trigger | Listeners |
|---|---|---|
| `fitgpt:guest-wardrobe-changed` | Wardrobe mutations | Dashboard, History, Favorites |
| `fitgpt:planned-outfits-changed` | Plan mutations | Plans |
| `fitgpt:saved-outfits-changed` | Save/unsave outfits | SavedOutfits, Profile |
| `fitgpt:profile-pic-changed` | Profile pic upload | TopNav |

---

## Environment Variables

### Backend
| Variable | Purpose |
|---|---|
| `SECRET_KEY` | JWT signing key |
| `DATABASE_URL` | DB connection string (default: SQLite) |
| `OPENWEATHER_API_KEY` | OpenWeatherMap weather API |
| `GROQ_API_KEY` | Groq AI API |
| `GOOGLE_CLIENT_ID` | Google OAuth verification |
| `GMAIL_ADDRESS` | Gmail sender for password reset emails |
| `GMAIL_APP_PASSWORD` | Gmail app-specific password |
| `FRONTEND_URL` | Base URL for password reset links |
| `CORS_ORIGINS` | Additional allowed CORS origins (comma-separated) |

### Frontend
| Variable | Purpose |
|---|---|
| `REACT_APP_API_BASE_URL` | Backend base URL (default: `http://127.0.0.1:8000`) |
| `REACT_APP_AUTH_STRATEGY` | `token` or `cookies` (default: `token`) |
| `REACT_APP_GOOGLE_CLIENT_ID` | Google OAuth client ID |

---

## Dev Commands
```bash
cd web && npm start                              # Frontend (port 3000)
cd backend && uvicorn app.main:app --reload     # Backend (port 8000)
cd web && npx react-scripts build               # Production build
```
