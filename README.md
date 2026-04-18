# FitGPT

FitGPT is an AI-powered wardrobe management and outfit recommendation app. It helps users
organize their clothing and receive clear, explainable outfit suggestions tailored to their
style preferences, body type, weather, and time of day.

The primary product is a **React web app** backed by a **FastAPI** service. An Android app
exists under `app/` but is no longer actively developed.

---

## Repository Layout

```text
FitGPT/
├── web/        React 19 frontend (Create React App)
├── backend/    FastAPI + SQLAlchemy backend
├── app/        Android app (dormant)
├── render.yaml Render deployment config
└── .github/    CI workflows (when permitted by auth scope)
```

---

## Local Development

### Prerequisites
- Python 3.12+ (3.13 supported)
- Node 20+
- npm

### Backend

```bash
cd backend
python -m venv .venv
# Windows:   .venv\Scripts\activate
# macOS/Lin: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # then fill in values, see below
uvicorn app.main:app --reload --port 8000
```

Backend runs at http://localhost:8000. Swagger UI at http://localhost:8000/docs.

#### Environment variables (`backend/.env`)
| Key | Required? | Purpose |
|-----|-----------|---------|
| `DATABASE_URL` | optional | PostgreSQL URL. Defaults to local SQLite `fitgpt.db` |
| `SECRET_KEY` | **yes for prod** | JWT signing key. Must not be default in production |
| `GROQ_API_KEY` | optional | Enables LLM-backed recommendations + AURA chat |
| `GROQ_MODEL` | optional | Defaults to `llama-3.3-70b-versatile` |
| `GOOGLE_CLIENT_ID` | optional | Enables Google sign-in |
| `GMAIL_ADDRESS` / `GMAIL_APP_PASSWORD` | optional | Sends password-reset emails |
| `FRONTEND_URL` | optional | Public frontend URL used in emails (default `http://localhost:3000`) |
| `CORS_ORIGINS` | optional | Comma-separated allowed origins (default includes localhost + known prod) |
| `OPENWEATHER_API_KEY` | optional | Live weather; fallback mode used if missing |

### Frontend

```bash
cd web
npm install
npm start
```

Frontend runs at http://localhost:3000.

#### Environment variables (`web/.env`)
| Key | Purpose |
|-----|---------|
| `REACT_APP_API_BASE_URL` | Backend base URL (default: hosted Render instance) |
| `REACT_APP_GOOGLE_CLIENT_ID` | Google OAuth client ID (public) |

---

## Testing

```bash
# Backend — 68 tests
cd backend && pytest -q

# Frontend — 601 tests
cd web && CI=true npm test -- --watchAll=false

# Frontend production build
cd web && CI=false npm run build
```

CI config lives in `.github/workflows/test.yml` and runs both suites on PR.

---

## Deployment

The backend is designed for Render.com deployment via `render.yaml`:

- FastAPI web service with `healthCheckPath: /health`
- Render-provisioned PostgreSQL, wired via `DATABASE_URL`
- Single-worker uvicorn on port 10000

The frontend deploys to Vercel or any static host.

---

## Architecture Notes

- **Local-first wardrobe**: sessionStorage is the source of truth for wardrobe items.
  All mutations are optimistic; API calls are best-effort.
- **Per-user storage isolation**: `web/src/utils/userStorage.js` namespaces all
  localStorage keys by user ID.
- **AI layer**: `backend/app/ai/` wraps Groq's LLM. Deterministic scoring runs first;
  the LLM re-ranks. User-controlled fields are sanitized before prompt inclusion.
- **Themes**: 10 presets + custom builder, managed via CSS variables in
  `web/src/theme/`.

For deeper architectural detail (including common bugs and their root causes), see
[`CLAUDE.md`](./CLAUDE.md) at the repo root.

---

## Project Status

Active senior project. Web app is the primary deliverable; Android is archived.
