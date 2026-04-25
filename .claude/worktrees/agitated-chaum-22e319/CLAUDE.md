# FitGPT - Claude Code Reference

## Project Overview
AI-powered outfit recommendation web app. React frontend + FastAPI backend.
Users upload wardrobe items (with photos), get daily outfit recommendations based on style preferences, body type, weather, and time of day.

## Repo Structure
```
FitGPT/
├── web/                    # React frontend (CRA)
│   └── src/
│       ├── App.js          # Root: ThemeContext provider, one-time localStorage cleanup
│       ├── App.css          # All styles, dark mode via [data-theme="dark"]
│       ├── routes/
│       │   └── AppRoutes.js # React Router v6 routes, onboarding persistence (localStorage)
│       ├── auth/
│       │   ├── AuthProvider.js  # AuthContext, calls getMe() on mount
│       │   └── ProtectedRoute.js
│       ├── components/
│       │   ├── Dashboard.js     # Main page: recommendations engine, weather, theme toggle
│       │   ├── Wardrobe.js      # Upload/manage clothing items (single + bulk upload)
│       │   ├── Favorites.js     # View/unfavorite items
│       │   ├── History.js       # Outfit wear history
│       │   ├── Profile.js       # Account, saved outfits, reuse outfit
│       │   ├── Analytics.js     # Wardrobe analytics: category/color pie charts, wear frequency bars, activity timeline (recharts)
│       │   ├── HistoryAnalytics.js  # Tab container wrapping History + Analytics, persists tab via searchParams
│       │   ├── Plans.js         # Planned outfits (upcoming/past), "Wear This" stores to sessionStorage
│       │   ├── SavedOutfits.js
│       │   ├── ClothCard.js     # R3F cloth shader for outfit tile images (GLSL vertex/fragment)
│       │   ├── TopNav.js        # Navigation bar (7 links), animated profile pic with GIF freeze-on-nav
│       │   ├── ThemePicker.js   # Dropdown theme selector: Classic/Color/Seasonal/Custom groups, max 5 custom
│       │   ├── CustomThemeEditor.js  # Modal for creating custom color themes with live preview
│       │   ├── GuidedTutorial.js    # 23-step interactive tour with SVG spotlight mask, auto-advance after 2.5s
│       │   ├── PageTransition.js    # Wrapper that remounts children on route change for CSS fade-in
│       │   ├── ForgotPassword.js    # Password reset request form (POST /auth/forgot-password)
│       │   ├── ResetPassword.js     # Password reset form (token from URL, POST /auth/reset-password)
│       │   ├── onboarding/Onboarding.js  # 5-step onboarding (style, comfort, occasion, body type)
│       │   ├── onboarding/SplashCrumple.js  # Canvas splash screen with affine-mapped crumple animation
│       │   ├── Chatbot.js          # AURA AI assistant: multi-chat history, share, typewriter, localStorage persistence
│       │   ├── AuthPrompt.js, Login.js, Signup.js, Register.js
│       ├── theme/
│       │   ├── themeDefinitions.js  # 10 preset themes (classic/color/seasonal) + buildCustomTheme()
│       │   ├── themeEngine.js       # applyTheme(): sets data-theme + inline CSS vars; clearThemeOverrides()
│       │   └── colorUtils.js        # hexToRgb, darken, lighten, deriveAccentVars() — 11 derived vars from one accent color
│       ├── utils/
│       │   ├── userStorage.js       # Per-user storage helpers: loadWardrobe, saveWardrobe, migrateGuestData
│       │   └── classifyClothing.js  # TensorFlow.js + MobileNet v2: auto-categorize uploads into 5 clothing categories
│       └── api/
│           ├── apiFetch.js          # Base fetch wrapper, auth headers, BASE_URL=localhost:8000
│           ├── wardrobeApi.js       # CRUD for wardrobe items
│           ├── authApi.js           # register, login, getMe, logout
│           ├── savedOutfitsApi.js   # Save/list outfits (localStorage fallback)
│           ├── outfitHistoryApi.js  # Record/list outfit history (localStorage fallback)
│           ├── plannedOutfitsApi.js # Plan/list/remove outfits (localStorage only, per-user namespaced)
│           ├── recommendationsApi.js # POST /recommendations/ai — strips image_url, sends wardrobe + context
│           ├── chatApi.js           # POST /chat — sends conversation history, returns assistant reply
│           └── weatherApi.js, profileApi.js, preferencesApi.js
├── backend/                # FastAPI backend
│   └── app/
│       ├── main.py         # FastAPI app, CORS middleware, includes router + auth_router
│       ├── routes.py       # API endpoints: wardrobe CRUD, auth (dual router: / and /auth/)
│       ├── schemas.py      # Pydantic models (UserLogin for JSON login)
│       ├── models.py       # SQLAlchemy models
│       ├── crud.py         # DB operations
│       ├── auth.py         # JWT auth helpers
│       ├── database.py     # DB engine/session (SQLite default, PostgreSQL via DATABASE_URL)
│       ├── weather.py      # Weather integration
│       ├── email.py        # Gmail SMTP for password reset emails (requires GMAIL_ADDRESS, GMAIL_APP_PASSWORD)
│       ├── groq_service.py # Groq API (llama-3.1-8b-instant) for AI outfit recommendations
│       └── chat_service.py # AURA chatbot: Groq API (llama-3.1-8b-instant), system prompt with full app knowledge base
└── app/                    # Android/Kotlin app (not actively developed)
```

## Critical Architecture Decisions

### Storage: Single Source of Truth
- **sessionStorage** (`fitgpt_guest_wardrobe_v1`) is THE source of truth for wardrobe items
- `loadWardrobeForUser()` in Dashboard/History/Favorites reads sessionStorage FIRST, falls back to localStorage
- Wardrobe.js ALWAYS saves to sessionStorage via `saveGuestItems()`, regardless of auth state
- Favorites.js `saveWardrobeForUser()` ALWAYS writes to sessionStorage
- **Never gate storage writes on `effectiveSignedIn`** -- that caused items to be lost

### Local-First, API Best-Effort
All wardrobe mutations (add, delete, edit, favorite, archive) follow this pattern:
1. Update local state immediately (optimistic UI)
2. Try API call if `effectiveSignedIn` is true
3. **Ignore API errors silently** -- local change is already persisted to sessionStorage
4. Never revert local changes on API failure

This was a hard-won fix. The previous pattern reverted UI changes on non-network API errors, causing "request failed" toasts for favorites, archives, edits, and deletes.

### Auth State Pitfalls
- `user` from `useAuth()` can be truthy from demo sign-in (`{ demoEmail: "..." }`) even when backend is down
- `effectiveSignedIn = !!user && !backendOffline` in Wardrobe -- but `backendOffline` is component-local state, resets on remount
- Dashboard/History/Favorites should NOT use `!!user` to decide storage source -- always prefer sessionStorage
- `getMe()` in AuthProvider fires on mount; if backend is down, `user` stays null

### Per-User Data Isolation
- `web/src/utils/userStorage.js` namespaces storage keys by user ID
- `getUserId(user)` extracts stable ID (priority: id > user_id > email > demoEmail)
- `userKey(baseKey, user)` returns `baseKey_<id>` for signed-in, `baseKey` for guests
- `loadWardrobe(user)` / `saveWardrobe(items, user)` centralize wardrobe storage (replaces per-component duplicates)
- `migrateGuestData(user)` runs on login (in AuthProvider + Login + Signup) -- copies base-key data to namespaced keys
- All API modules (`savedOutfitsApi`, `outfitHistoryApi`, `profileApi`) accept `user` as last param for namespaced local storage
- Wardrobe.js uses `setItemsAndSave` wrapper + `localEditRef` to prevent race conditions between load/save effects

### Image Pipeline
- `fileToDataUrl(file)` thumbnails to 200x200 JPEG at 0.7 quality, returns `data:image/jpeg;base64,...`
- Stored as `image_url` field on each wardrobe item in sessionStorage
- Pipeline: `bucketWardrobe({...x})` preserves image_url → `generateThreeOutfits` maps `image_url: x.image_url || ""` → render checks truthy
- If `image_url` is falsy, a gradient placeholder div is shown

### Image Classification
- `web/src/utils/classifyClothing.js` uses TensorFlow.js + MobileNet v2 to auto-categorize uploaded clothing images
- Lazy-loads model on first call (singleton, ~16MB from Google CDN, browser-cached)
- Maps ImageNet labels to 5 categories: Tops, Bottoms, Outerwear, Shoes, Accessories (123-entry map)
- MIN_CONFIDENCE threshold: 0.08 (8%). Never throws — returns `{ category: null }` on failure.

### Recommendation Engine (Dashboard.js)
- `generateThreeOutfits(wardrobe, recSeed, bodyType, recentSigs, recentCounts, weather, time, answers)`
- Uses seeded PRNG (`mulberry32`) for reproducible shuffling
- `recSeed` persisted to sessionStorage so recommendations survive navigation
- Scoring: color pairing + fit penalty + weather bias + time bias - recent frequency
- Falls back to `defaultOutfitSet()` when wardrobe is empty (Navy Blazer, White Button-Up, etc.)

### AI Recommendations (Groq)
- `backend/app/groq_service.py` calls Groq API with `llama-3.1-8b-instant` model
- `recommendationsApi.js` strips `image_url` from items before sending (only sends: id, name, category, color, fit_type, style_tag)
- Backend validates: filters hallucinated IDs, deduplicates per category, requires min 2 items per outfit
- Returns up to 3 outfits or `None` on failure (caller falls back to local algorithm)

### Theme System
- Managed in App.js via `ThemeContext` (not Dashboard-local)
- `data-theme="dark"` attribute on `<html>`, CSS variables override in `[data-theme="dark"]`
- Toggle has fade overlay animation (300ms swap, 380ms fade-out, 720ms cleanup)
- **Theme engine** (`web/src/theme/`):
  - `themeDefinitions.js`: 10 preset themes (2 classic, 4 color, 4 seasonal) + `buildCustomTheme()`
  - `themeEngine.js`: `applyTheme()` sets `data-theme` + inline CSS vars (23 properties); classic themes use attribute selectors only, presets/custom use inline vars for highest specificity
  - `colorUtils.js`: `deriveAccentVars(accentHex, base)` generates 11 accent-related CSS vars from a single color
- **ThemePicker.js**: dropdown with grouped sections, max 5 custom themes, delete support
- **CustomThemeEditor.js**: modal with color pickers, light/dark base toggle, advanced overrides, live preview
- Custom themes persisted to `fitgpt_custom_themes_v1` in localStorage

### Event-Driven Updates
Custom DOM events for cross-component communication:
- `fitgpt:guest-wardrobe-changed` — wardrobe mutations notify Dashboard/History/Favorites
- `fitgpt:planned-outfits-changed` — plan mutations notify Plans component
- `fitgpt:profile-pic-changed` — profile pic updates notify TopNav

## Storage Keys

Keys marked with * are namespaced per-user when signed in (e.g., `fitgpt_wardrobe_v1_abc123`). Guests use the base key. See `userStorage.js`.

| Key | Storage | Purpose |
|-----|---------|---------|
| `fitgpt_guest_wardrobe_v1` * | sessionStorage | **Primary wardrobe data** |
| `fitgpt_wardrobe_v1` * | localStorage | Legacy/backend-synced wardrobe (fallback only) |
| `fitgpt_saved_outfits_v1` * | localStorage | Saved outfit combinations |
| `fitgpt_planned_outfits_v1` * | localStorage | Planned outfits array |
| `fitgpt_outfit_history_v1` * | localStorage | Outfit wear history |
| `fitgpt_profile_v1` * | localStorage | User profile data |
| `fitgpt_profile_pic_v1` * | localStorage | Profile picture (data URL) |
| `fitgpt_onboarding_answers_v1` | localStorage | Onboarding answers |
| `fitgpt_onboarded_v1` | localStorage | Onboarding completion flag |
| `fitgpt_tutorial_done_v1` | localStorage | Guided tutorial completion flag |
| `fitgpt_theme_v1` | localStorage | Active theme ID |
| `fitgpt_custom_themes_v1` | localStorage | Custom theme definitions array |
| `fitgpt_rec_seed_v1` | sessionStorage | Recommendation seed |
| `fitgpt_token_v1` | localStorage | JWT auth token |
| `fitgpt_demo_auth_v1` | localStorage | Demo sign-in state |
| `fitgpt_reuse_outfit_v1` | sessionStorage | Outfit reuse from Profile/Plans |
| `fitgpt_chat_history_v1` | localStorage | AURA conversation history (up to 30 chats) |

## Backend Notes
- FastAPI on port 8000, CORS allows localhost:3000 and 127.0.0.1:3000
- Dual routers: `router` (root) + `auth_router` (prefix `/auth`) for endpoint compatibility
- Login accepts JSON body via `UserLogin` schema (not form-data)
- DELETE `/wardrobe/items/{item_id}` expects `int` ID -- local items use hex string IDs, so this always fails for guest items
- PUT `/wardrobe/items/{item_id}` expects full `ClothingItemCreate` schema -- partial updates (just `is_favorite`) fail validation
- Backend is often offline during development; frontend must work fully without it
- Database: SQLite default (`fitgpt.db`), PostgreSQL via `DATABASE_URL` env var (auto-converts `postgres://` → `postgresql://`)
- Password reset: `email.py` sends via Gmail SMTP (requires `GMAIL_ADDRESS`, `GMAIL_APP_PASSWORD`, `FRONTEND_URL` env vars)
- AI recommendations: `groq_service.py` calls Groq API (requires `GROQ_API_KEY` env var)

### Backend Endpoints (beyond wardrobe CRUD)
- `POST /auth/forgot-password` — triggers password reset email
- `POST /auth/reset-password` — validates token, updates password
- `POST /recommendations/ai` — AI outfit recommendations via Groq
- `POST /chat` — AURA chatbot (Groq, llama-3.1-8b-instant, max_tokens 2048)

## Common Bugs & Solutions

### "Items not showing in recommendations"
- Check `loadWardrobeForUser()` -- must prefer sessionStorage over localStorage
- Check if stale data in `localStorage fitgpt_wardrobe_v1` is shadowing fresh sessionStorage data
- Verify `saveGuestItems()` in Wardrobe runs unconditionally (not gated on `!effectiveSignedIn`)

### "Request failed" on any wardrobe action
- The action handler is calling the backend API and the call fails
- Fix: always save locally first, make API call best-effort with silent catch

### "Items lost on navigation"
- Save effect was gated on `!effectiveSignedIn` -- items in memory never persisted to sessionStorage
- Fix: always persist to sessionStorage regardless of auth state

### "Have to refresh to see changes"
- Dashboard `loadWardrobeForUser` was reading wrong storage based on `!!user`
- `fitgpt:guest-wardrobe-changed` event listener was gated on `!user`
- Fix: always read sessionStorage first; event listener always refreshes

## Dev Commands
```bash
cd web && npm start          # Frontend dev server (port 3000)
cd backend && uvicorn app.main:app --reload  # Backend (port 8000)
cd web && npx react-scripts build            # Production build
```

## GLSL / Three.js (ClothCard)
- `web/src/components/ClothCard.js` — R3F-based cloth shader for outfit tiles in Dashboard
- Dependencies: `three`, `@react-three/fiber`, `@react-three/drei`
- Only the **selected outfit option** renders ClothCard (limits WebGL contexts to ~4); unselected outfits use regular `<img>`
- Vertex shader: multi-frequency sine displacement pinned at top edge, gravity drape, 2s settle animation, ambient breeze
- Fragment shader: `dFdx`/`dFdy` surface normals, two-point fabric lighting
- **ColorSpace pitfall**: Do NOT set `tex.colorSpace = THREE.SRGBColorSpace` on textures in `ShaderMaterial` — it decodes sRGB→linear on fetch but ShaderMaterial doesn't re-encode on output, causing darkened images. Leave colorSpace unset.
- **Plane sizing**: Use `useThree().viewport` to scale the mesh (`scale={[viewport.width, viewport.height, 1]}` on a 1×1 plane). Hardcoded sizes overflow the ortho camera frustum and cause zoom/crop.
- CSS 3D card reveal animations in App.css: `outfitSlideIn` (perspective rotateX), `tileReveal` (perspective rotateY with staggered delays), `perspective: 800px` on grid container

## Notable Frontend Features

### SplashCrumple (onboarding/SplashCrumple.js)
- Canvas-based splash screen with entry animations → interactive crumple effect
- Two phases: intro (logo/title/subtitle slide-up, 750ms) → crumple (affine texture-mapped mesh distortion, 750ms + 120ms hold + 450ms drop)
- Uses triangulated mesh with noise grid (18x18) for natural crumple, creases drawn as lines
- Auto-dismiss after 2.5s

### GuidedTutorial (GuidedTutorial.js)
- 23-step interactive tour: spotlight, navigate, and done-card step types
- SVG mask cutout highlights DOM elements, tooltip positioning with smart above/below fallback
- Routes through: dashboard → wardrobe → favorites → history → saved → plans → profile
- Auto-advance after 2.5s inactivity; persists completion to `fitgpt_tutorial_done_v1`

### TopNav GIF Handling
- Profile picture GIFs are frozen (drawn to canvas → PNG) for nav performance
- Animated on hover only

### Analytics (Analytics.js)
- Wardrobe breakdown by category/color (pie charts), wear frequency (bar charts), activity timeline (6-month area chart)
- Uses recharts; dynamically reads theme colors from CSS variables with MutationObserver

### AURA (Chatbot.js)
- AI assistant floating in bottom-right corner of every page (branded as "AURA")
- Backend: `chat_service.py` with Groq API (llama-3.1-8b-instant, max_tokens 2048), comprehensive system prompt containing full app knowledge base
- **Multi-chat history**: Up to 30 conversations persisted in localStorage (`fitgpt_chat_history_v1`)
- Chat management: new chat, switch, delete, auto-derived titles from first user message
- **Share**: `navigator.share` on mobile, `navigator.clipboard` on desktop, with toast confirmation
- **Typewriter effect**: Character-by-character rendering for assistant replies (12ms per char)
- **Logo**: Custom robotic mannequin image (`/fitgpt-logo.png`) used in toggle button, header, and message avatars
- UI: two-row header (title + close on top, action buttons below), pill-shaped composer with circular send button

## Style Notes
- Skewed save button: `clip-path: polygon(...)`, `skewX(-4deg)`, gradient backgrounds
- Soft theme transition: opacity fade overlay, not hard waterfall
- Dark mode: comprehensive CSS variable overrides for all components
