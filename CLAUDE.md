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
│       │   ├── onboarding/Onboarding.js  # 5-step onboarding (style, comfort, occasion, body type)
│       │   ├── AuthPrompt.js, Login.js, Signup.js, Register.js
│       │   └── SavedOutfits.js
│       ├── utils/
│       │   └── userStorage.js   # Per-user storage helpers: loadWardrobe, saveWardrobe, migrateGuestData
│       └── api/
│           ├── apiFetch.js      # Base fetch wrapper, auth headers, BASE_URL=localhost:8000
│           ├── wardrobeApi.js   # CRUD for wardrobe items
│           ├── authApi.js       # register, login, getMe, logout
│           ├── savedOutfitsApi.js   # Save/list outfits (localStorage fallback)
│           ├── outfitHistoryApi.js  # Record/list outfit history (localStorage fallback)
│           └── weatherApi.js, profileApi.js, preferencesApi.js
├── backend/                # FastAPI backend
│   └── app/
│       ├── main.py         # FastAPI app, CORS middleware, includes router + auth_router
│       ├── routes.py       # API endpoints: wardrobe CRUD, auth (dual router: / and /auth/)
│       ├── schemas.py      # Pydantic models (UserLogin for JSON login)
│       ├── models.py       # SQLAlchemy models
│       ├── crud.py         # DB operations
│       ├── auth.py         # JWT auth helpers
│       ├── database.py     # DB engine/session
│       └── weather.py      # Weather integration
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

### Recommendation Engine (Dashboard.js)
- `generateThreeOutfits(wardrobe, recSeed, bodyType, recentSigs, recentCounts, weather, time, answers)`
- Uses seeded PRNG (`mulberry32`) for reproducible shuffling
- `recSeed` persisted to sessionStorage so recommendations survive navigation
- Scoring: color pairing + fit penalty + weather bias + time bias - recent frequency
- Falls back to `defaultOutfitSet()` when wardrobe is empty (Navy Blazer, White Button-Up, etc.)

### Theme System
- Managed in App.js via `ThemeContext` (not Dashboard-local)
- `data-theme="dark"` attribute on `<html>`, CSS variables override in `[data-theme="dark"]`
- Toggle has fade overlay animation (300ms swap, 380ms fade-out, 720ms cleanup)
- Pill-shaped toggle button with sun/moon icons

## Storage Keys

Keys marked with * are namespaced per-user when signed in (e.g., `fitgpt_wardrobe_v1_abc123`). Guests use the base key. See `userStorage.js`.

| Key | Storage | Purpose |
|-----|---------|---------|
| `fitgpt_guest_wardrobe_v1` * | sessionStorage | **Primary wardrobe data** |
| `fitgpt_wardrobe_v1` * | localStorage | Legacy/backend-synced wardrobe (fallback only) |
| `fitgpt_saved_outfits_v1` * | localStorage | Saved outfit combinations |
| `fitgpt_onboarding_answers_v1` | localStorage | Onboarding answers |
| `fitgpt_onboarded_v1` | localStorage | Onboarding completion flag |
| `fitgpt_theme_v1` | localStorage | Light/dark theme |
| `fitgpt_rec_seed_v1` | sessionStorage | Recommendation seed |
| `fitgpt_token_v1` | localStorage | JWT auth token |
| `fitgpt_demo_auth_v1` | localStorage | Demo sign-in state |
| `fitgpt_reuse_outfit_v1` | sessionStorage | Outfit reuse from Profile |
| `fitgpt_outfit_history_v1` * | localStorage | Outfit wear history |
| `fitgpt_profile_v1` * | localStorage | User profile data |

## Backend Notes
- FastAPI on port 8000, CORS allows localhost:3000 and 127.0.0.1:3000
- Dual routers: `router` (root) + `auth_router` (prefix `/auth`) for endpoint compatibility
- Login accepts JSON body via `UserLogin` schema (not form-data)
- DELETE `/wardrobe/items/{item_id}` expects `int` ID -- local items use hex string IDs, so this always fails for guest items
- PUT `/wardrobe/items/{item_id}` expects full `ClothingItemCreate` schema -- partial updates (just `is_favorite`) fail validation
- Backend is often offline during development; frontend must work fully without it

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

## Style Notes
- Skewed save button: `clip-path: polygon(...)`, `skewX(-4deg)`, gradient backgrounds
- Soft theme transition: opacity fade overlay, not hard waterfall
- Dark mode: comprehensive CSS variable overrides for all components
