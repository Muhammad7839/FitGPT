# FitGPT Audit Log

Running log of the full-codebase audit & cleanup started 2026-04-23 on branch `main`.
The final structured deliverable is `docs/AUDIT_REPORT.md` (Step 8).

---

## Step 0 — Prep

- Started on branch `main`, working tree clean. `main` and `backend-features` have identical file contents as of audit start (verified via `git diff main backend-features` → 0 lines).
- Plan approved: all three surfaces (backend + web + android), commit directly to `main`, deep test coverage.
- Local toolchain: Python 3.9.6 (backend targets 3.12 in prod; 3.9 runs tests fine — no 3.10+-only syntax in backend), Node 22.16 (CI uses 20, compatible).
- Kicked off `npm install` in `web/` and `pip install -r backend/requirements.txt` inside `.venv/` so tests can run between steps.

## Step 1 — Project understanding

### Top-level layout

| Directory | Purpose |
|-----------|---------|
| `backend/` | FastAPI Python server (auth, wardrobe, recommendations, chat, OCR, weather). |
| `web/` | React 19 CRA frontend (main user-facing surface). |
| `app/` | Kotlin + Jetpack Compose Android app (MVVM with `ServiceLocator` DI). |
| `docs/` | Project documentation (UX hardening, parity matrix, this log). |
| `.github/workflows/` | Single `test.yml` CI workflow. |
| `gradle/` | Gradle wrapper. |

Root-level config: `build.gradle.kts`, `settings.gradle.kts`, `gradle.properties`, `gradlew` (Android); `pytest.ini` (backend); `render.yaml`, `runtime.txt` (deploy); `README.md`, `AGENTS.md`.

### Tech stack

- **Backend**: Python 3.12 (prod) / 3.9 (local dev), FastAPI 0.110.0, SQLAlchemy 2.0.43, Uvicorn 0.29.0, passlib[bcrypt] 1.7.4, bcrypt <5, python-jose 3.5.0 (JWT), pydantic 2.6.4, google-auth 2.40.3, requests 2.32.4, pytest 8.4.1, httpx 0.27.2.
- **Web**: React 19.2.4, React Router 7.13.0, Recharts 3.7.0, Three.js 0.183.2 (3D mannequin), @tensorflow/tfjs + @tensorflow-models/mobilenet 4.22.0 (on-device classification).
- **Android**: Kotlin + Jetpack Compose (BOM-managed), Retrofit 2.11.0 + OkHttp 4.12.0, Play Services Auth 21.2.0, Location 21.3.0, Coil 2.7.0.

### Entry points

- Backend: `backend/app/main.py` (FastAPI app; CORS middleware; runtime schema migration; `/health`, `/`, `/uploads/*`, router mounted).
- Web: `web/src/index.js` → `web/src/App.js` (React Router routes).
- Android: `app/src/main/java/com/fitgpt/app/MainActivity.kt` (Compose).

### Dependencies of note

- `backend/requirements.txt` — pinned; `passlib[bcrypt]==1.7.4` + `bcrypt<5` (known Python 3.13 / passlib compat fix already in history).
- `web/package.json` — React 19; heavy ML/3D deps loaded lazily.
- `app/build.gradle.kts:44-58` — injects `GOOGLE_WEB_CLIENT_ID`, `API_BASE_URL`, `API_LAN_BASE_URL` as `BuildConfig` fields from `gradle.properties`.

### Config files

| File | What it controls |
|------|------------------|
| `backend/.env.example` | `ENVIRONMENT`, `SECRET_KEY`, `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GROQ_API_KEY`/`GROQ_MODEL`, `AI_TIMEOUT_SECONDS`, token expiry, `EXPOSE_RESET_TOKEN_IN_RESPONSE=false`. |
| `backend/app/config.py` | Loads env, validates critical secrets, logs optional-config warnings. |
| `web/.env.local` | `NEXT_PUBLIC_API_URL` (actually consumed as CRA `REACT_APP_*`; verify). |
| `pytest.ini` | Warning filters for urllib3 / python-multipart deprecations. |
| `.github/workflows/test.yml` | Backend pytest on Python 3.12 + web `npm install && npm test && npm run build`. |

No project-level ESLint or Prettier config found; no `tsconfig.json` (no TypeScript). Android uses Gradle + ktlint implicit defaults.

### Test infrastructure

- **Backend**: 24 test files under `backend/tests/` + `backend/tests/conftest.py` providing `reset_db`, `register_and_login`, isolated SQLite DB (`sqlite:///file:memdb?mode=memory&cache=shared&uri=true` or `/tmp/fitgpt_test.db`). pytest 8.4.1.
- **Web**: 22 `*.test.js` files; only 3 are component tests (`OutfitBuilder`, `ReceiptScannerModal`, `TripPackingPlanner`), rest are util/logic tests. Jest via `react-scripts test`.
- **Android**: `app/src/test/` has some unit scaffolding; no CI runs Gradle tests.

### CI

`.github/workflows/test.yml` (62 lines, triggers on PR to `main`/`dieuni` and pushes to `main`):
1. `backend` job: Ubuntu + Python 3.12 → `pip install -r backend/requirements.txt` → `pytest -q` under `backend/`.
2. `frontend` job: Ubuntu + Node 20 → `npm install` → `npm test -- --watchAll=false --passWithNoTests` → `npm run build`.

No Android job.

### Summary stats

- Python: 45 files (`backend/app/`).
- JS: 112 files (`web/src/`).
- Kotlin: 119 files (`app/src/main/java/com/fitgpt/app/`).
- Tests: 24 backend, 22 web, minimal Android.

### Baseline test status (pre-audit)

| Suite | Command | Result |
|-------|---------|--------|
| Backend | `pytest -q` in `backend/` | **169 passed** in 56.8s |
| Web | `CI=true npm test -- --watchAll=false` in `web/` | **594 tests across 22 suites passed** in 2.8s |
| Android | not yet run | — |

All audit-step commits must preserve this baseline (or extend it). A regression is a blocker.

---

## Step 2 — Code hygiene cleanup

Used `pyflakes`, CRA eslint (`react-app` config), and targeted grep. Verified each finding before editing.

### Backend fixes

| File | Issue | Fix |
|------|-------|-----|
| `backend/app/crud.py:19` | Unused import `map_temperature_to_category`. | Removed. |
| `backend/app/crud.py:1016-1023` | Duplicate definition of `_jaccard_similarity` (second definition silently overrode the first; semantically equivalent, no behavior change). | Removed the second definition, kept the first at line 685. |
| `backend/app/main.py:10` | `from app import models` was flagged by pyflakes as unused. It is deliberate — SQLAlchemy needs the model modules imported so their table declarations register with `Base.metadata` before `Base.metadata.create_all()` on line 26. | Left import in place; added `# noqa: F401` comment documenting the side-effect intent. |

### Web fixes

| File | Issue | Fix |
|------|-------|-----|
| `web/src/utils/userStorage.test.js:11` | `TUTORIAL_DONE_KEY` imported but unused. | Removed from test's import list. (The constant is still used in `userStorage.js`.) |
| `web/src/utils/wardrobeRotationInsights.test.js:62` | `const history = []` assigned but never used. | Removed. |

### Findings verified and NOT changed

- `routes.py:65` — `request.client.host` access. Explore-agent flagged as missing None-guard. **Verified: already guarded** (`request.client and request.client.host`). No change.
- `web/src/components/Profile.js:54-56` — Explore-agent flagged as hook-ordering bug. **Verified: safe.** `useCallback` stores the callback body without evaluating it; lexical lookup of `setShowPicMenu` resolves correctly at call time after line 125 runs. No change.
- No `console.log` / `debugger` in non-test web sources (grep confirmed zero matches).
- No commented-out code blocks in backend or web sources (regex grep zero matches).
- No TODO/FIXME markers in backend or web sources.
- Android: 119 Kotlin files clean of TODO/FIXME. `Log.d(...)` statements present but are standard Android debug logger (filtered in release builds); leaving in place. Android deferred for deeper lint until blockers emerge (Gradle lint would be slow to bootstrap for audit-only run).

### Test status after Step 2

| Suite | Result |
|-------|--------|
| Backend `pytest -q` | 169 passed |
| Web `CI=true npm test` | 594 passed / 22 suites |

---
