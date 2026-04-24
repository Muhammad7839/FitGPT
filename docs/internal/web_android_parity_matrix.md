# FitGPT Web -> Android Parity Matrix

This matrix tracks feature parity between the `dieuni` web app and Android (`backend-features`) while keeping backend APIs canonical.

## Screen/Route Mapping

| Web Route/Area | Android Screen | Backend Endpoint(s) | Status | Notes |
|---|---|---|---|---|
| Welcome | `WelcomeScreen` | local onboarding state | `matched` | Hero-only onboarding flow aligned. |
| Guided tutorial | `GuidedTutorialOverlay` (Dashboard-first entry) | local tutorial preferences | `matched` | First authenticated dashboard entry shows a step guide and persists dismiss state. |
| Auth Login/Register/Me | `LoginScreen` / `SignupScreen` | `/login`, `/register`, `/me` + aliases `/auth/login`, `/auth/register`, `/auth/me` | `matched` | Web compatibility aliases added. |
| Dashboard | `DashboardScreen` | `/dashboard/context`, `/weather/current`, `/recommendations`, `/ai/recommendations`, `/outfits/planned` | `matched` | Weather trust states + upcoming plan summary + recommendation continuity card. |
| Wardrobe List/Search/Filters | `WardrobeScreen` | `/wardrobe/items` | `matched` | Search-first flow with collapsible advanced filters and season quick chips. |
| Wardrobe Duplicate Review | `WardrobeScreen` | `/wardrobe/duplicates` | `matched` | Android now surfaces likely duplicate pairs with archive-first review action. |
| Wardrobe Rotation Visibility | `WardrobeScreen` | `/wardrobe/underused-alerts` | `matched` | Android mirrors web underused/rotation visibility with refreshable alert cards. |
| Add Item / Upload | `AddItemScreen` | `/wardrobe/items`, `/wardrobe/items/image`, `/wardrobe/items/images` | `matched` | Single Add Photo entry, camera/gallery/multi-select in one flow, explicit upload/save state machine, stronger auto-fill hints. |
| Recommendation (AI + fallback) | `RecommendationScreen` | `/ai/recommendations`, `/recommendations`, alias `/recommendations/ai` | `matched` | Advanced controls preserved; now includes context/source/score transparency card plus quick feedback prompt handling. |
| Chat | `ChatScreen` via `More` | `/ai/chat`, alias `/chat` | `matched` | Backend-managed AI/fallback contract retained. |
| Favorites | `FavoritesScreen` | `/wardrobe/items/favorites`, `/wardrobe/items/{id}/favorite` | `matched` | Backend-first persistence. |
| Saved Outfits | `SavedOutfitsScreen` | `/outfits/saved` | `matched` | Backend-first persistence. |
| History + Analytics + Laundry | `HistoryScreen` | `/outfits/history`, `/outfits/history/range` | `matched` | Combined history, analytics, and estimated laundry insights tab view. |
| Plans | `PlansScreen` | `/outfits/planned`, `/outfits/planned/assign`, `/plans/packing-list`, `/recommendations/forecast` | `matched` | Date-picker-first UX retained, plus forecast-aware planner and packing list flow. |
| Profile | `ProfileScreen` | `/me/profile`, `/me/summary`, `/me/avatar` | `matched` | Identity-focused profile + avatar sync, with smart-alert preference visibility. |
| Settings | `SettingsScreen` | local preferences | `matched` | Theme mode + preset selection + custom theme create/edit/delete in one place. |
| More hub | `MoreScreen` | navigation only | `matched` | Keeps 4-tab IA with secondary features grouped. |

## API Compatibility Alias Matrix

| Alias Endpoint | Canonical Service Path | Status |
|---|---|---|
| `POST /auth/login` | login service used by `/login` | `active` |
| `POST /auth/register` | register service used by `/register` | `active` |
| `GET /auth/me` | current user service used by `/me` | `active` |
| `POST /chat` | AI chat service used by `/ai/chat` | `active` |
| `POST /recommendations/ai` | AI recommendation service used by `/ai/recommendations` | `active` |
| `GET /dashboard/context` | weather context composition over current weather service | `active` |
| `GET /wardrobe/duplicates` | duplicate candidate scan used by parity review surfaces | `active` |
| `GET /recommendations/forecast` | forecast-aware recommendation planner | `active` |
| `GET /weather/forecast` | backend daily forecast for web planner bootstrap | `active` |

## Weekly Sync Procedure

1. Diff latest `dieuni` route/component changes against this matrix.
2. Mark each changed row as `matched`, `UI gap`, `behavior gap`, or `backend gap`.
3. Implement approved deltas in `backend-features` without merging `dieuni`.
4. Re-run backend and Android tests before each weekly merge.

## 2026-04-11 Snapshot

- Web app from `origin/dieuni` is now present under `web/` and builds successfully on `backend-features`.
- Web auth/onboarding flow is aligned to the current backend aliases and now routes directly into onboarding/dashboard after signup or sign-in.
- Web avatar persistence now uses `/me/avatar` for authenticated users.
- Android now exposes duplicate review, wardrobe rotation visibility, forecast planner, laundry insights, and richer recommendation context without changing the existing MVVM/navigation structure.
