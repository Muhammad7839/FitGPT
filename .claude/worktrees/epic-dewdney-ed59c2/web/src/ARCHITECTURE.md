# FitGPT Frontend Architecture

## Project
- AI outfit recommendation app: React frontend (CRA) + FastAPI backend
- Frontend: `web/` | Backend: `backend/`

## Key Architecture
- **sessionStorage is THE source of truth** for wardrobe items (`fitgpt_guest_wardrobe_v1`)
- All wardrobe mutations are local-first, API best-effort (silent catch on API errors)
- Theme managed in App.js via ThemeContext, not component-local
- **Per-user data storage**: `web/src/utils/userStorage.js` namespaces storage keys by user ID
- All API modules accept `user` as last param for namespaced local storage
- Components import `loadWardrobe`/`saveWardrobe` from userStorage
- See `CLAUDE.md` at repo root for full reference

## Architecture Refactoring — A+ Grade Achieved

### Storage Centralization (userStorage.js — 22 exported functions)
- **Factory pattern**: `makeLocalStore(key, event)` / `makeObjectStore(key, event)` eliminate boilerplate across all 4 API modules (savedOutfitsApi, outfitHistoryApi, plannedOutfitsApi, profileApi)
- **Session overrides**: `readWeatherOverride`/`setWeatherOverride`, `readTimeOverride`/`writeTimeOverride`, `readRecSeed`/`writeRecSeed` — moved from Dashboard.js + weatherApi.js
- **Demo auth**: `readDemoAuth`/`writeDemoAuth` — shared by Profile.js + TopNav.js
- **Onboarding**: `loadAnswers`/`saveAnswers`/`isOnboarded`/`clearOnboarding` — moved from AppRoutes.js, also used by Profile.js + Wardrobe.js
- **Profile pic**: `loadProfilePic`/`saveProfilePic` — deduplicates Profile.js + TopNav.js
- **Tutorial flag**: `isTutorialDone`/`markTutorialDone` — used by GuidedTutorial.js + AppRoutes.js
- All storage keys in `utils/constants.js` — zero hardcoded `fitgpt_` strings anywhere

### Component Extraction
- **recommendationEngine.js**: 744 lines extracted from Dashboard.js (scoring, generation, color pairing)
- **UpcomingPlanCard.js**: Extracted from Dashboard.js IIFE, React.memo'd
- **WardrobeItemCard.js**: Unified grid/list card views from Wardrobe.js, React.memo'd (14 props)
- **BulkUploadModal.js**: Extracted ~100 lines of bulk upload JSX from Wardrobe.js, React.memo'd
- **ItemFormFields.js**: Shared form component for Add + Edit modals, React.memo'd

### Performance
- **React.memo**: 6 components (ClothCard, MeshGradient, ItemFormFields, UpcomingPlanCard, WardrobeItemCard, BulkUploadModal)
- **React.lazy**: 8 lazy-loaded routes with Suspense + RouteSpinner fallback
- **ErrorBoundary**: Per-route wrapping + top-level + WebGL components
- **Code splitting**: Main bundle 81% smaller (466→90 kB)

### Code Quality
- Zero build warnings ("Compiled successfully")
- Zero unused exports
- Zero TODO/FIXME/HACK comments, zero console.log/console.error
- Zero circular imports — linear dependency graph: constants → helpers → userStorage → API → components
- 147 tests across 7 files, all passing

### Key File Sizes
- Wardrobe.js: 1218 lines | Dashboard.js: 946 | Analytics.js: 594 | Profile.js: 558
- userStorage.js: 289 | userStorage.test.js: 370

### Dead Code Removed
- `preferencesApi.js` — deleted (never imported)
- `labelForTempCategory` — deleted from weatherApi.js (never used)
- `tempCategoryFromF` — un-exported in weatherApi.js (internal only)
- `getToken` — un-exported in apiFetch.js (internal only)
- `outfitHistoryApi.normalizeItems` — removed re-export (never called via API object)
- Weather override format bug fixed (Dashboard vs weatherApi incompatible JSON formats)
- `monthKey` unified in helpers.js (was duplicated in Analytics.js + History.js)
- `useWardrobe` hardcoded strings replaced with constants

## Hard-Won Lessons
1. Never gate sessionStorage writes on `effectiveSignedIn` — causes data loss on navigation
2. Never use `!!user` to pick storage source — demo auth makes user truthy while backend is down
3. `loadWardrobeForUser()` must prefer sessionStorage over localStorage — stale localStorage shadows fresh data
4. All action handlers must save locally first, never revert on API failure
5. `backendOffline` is component-local state that resets on remount — don't rely on it across navigations
6. Backend expects `int` IDs and full schemas — local items use hex IDs and partial updates always fail

## GLSL / Three.js (ClothCard)
- `ClothCard.js` — R3F cloth shader on selected outfit tiles
- **ColorSpace pitfall**: Don't set `tex.colorSpace = THREE.SRGBColorSpace` on ShaderMaterial textures
- **Plane sizing**: Use `useThree().viewport` to scale the plane mesh
- Only selected outfit gets ClothCard (limits WebGL contexts)
