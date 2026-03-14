# FitGPT Web -> Android Parity Matrix

This matrix tracks feature parity between the `dieuni` web app and Android (`backend-features`) while keeping backend APIs canonical.

## Screen/Route Mapping

| Web Route/Area | Android Screen | Backend Endpoint(s) | Status | Notes |
|---|---|---|---|---|
| Welcome | `WelcomeScreen` | local onboarding state | `matched` | Hero-only onboarding flow aligned. |
| Guided tutorial | `GuidedTutorialOverlay` (Dashboard-first entry) | local tutorial preferences | `matched` | First authenticated dashboard entry shows a step guide and persists dismiss state. |
| Auth Login/Register/Me | `LoginScreen` / `SignupScreen` | `/login`, `/register`, `/me` + aliases `/auth/login`, `/auth/register`, `/auth/me` | `matched` | Web compatibility aliases added. |
| Dashboard | `DashboardScreen` | `/dashboard/context`, `/weather/current`, `/recommendations`, `/ai/recommendations`, `/outfits/planned` | `matched` | Weather trust states + upcoming plan summary + recommendation continuity card. |
| Wardrobe List/Search/Filters | `WardrobeScreen` | `/wardrobe/items` | `matched` | Search-first flow with collapsible advanced filters. |
| Add Item / Upload | `AddItemScreen` | `/wardrobe/items`, `/wardrobe/items/image`, `/wardrobe/items/images` | `matched` | Single Add Photo entry, camera/gallery/multi-select in one flow, explicit upload/save state machine, stronger auto-fill hints. |
| Recommendation (AI + fallback) | `RecommendationScreen` | `/ai/recommendations`, `/recommendations`, alias `/recommendations/ai` | `matched` | Advanced controls preserved; empty-state usability fixed. |
| Chat | `ChatScreen` via `More` | `/ai/chat`, alias `/chat` | `matched` | Backend-managed AI/fallback contract retained. |
| Favorites | `FavoritesScreen` | `/wardrobe/items/favorites`, `/wardrobe/items/{id}/favorite` | `matched` | Backend-first persistence. |
| Saved Outfits | `SavedOutfitsScreen` | `/outfits/saved` | `matched` | Backend-first persistence. |
| History + Analytics | `HistoryScreen` | `/outfits/history` | `matched` | Combined history and analytics tab view. |
| Plans | `PlansScreen` | `/outfits/planned`, `/outfits/planned/assign` | `matched` | Date-picker-first UX retained. |
| Profile | `ProfileScreen` | `/me/profile`, `/me/summary`, `/me/avatar` | `matched` | Identity-focused profile + avatar sync. |
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

## Weekly Sync Procedure

1. Diff latest `dieuni` route/component changes against this matrix.
2. Mark each changed row as `matched`, `UI gap`, `behavior gap`, or `backend gap`.
3. Implement approved deltas in `backend-features` without merging `dieuni`.
4. Re-run backend and Android tests before each weekly merge.
