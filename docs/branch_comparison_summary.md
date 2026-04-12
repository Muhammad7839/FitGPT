# Branch Comparison Summary

This document records the practical migration status of major FitGPT branch families relative to `backend-features`.

## Canonical Source Decision

- `backend-features` remains the canonical backend and Android integration branch.
- `origin/dieuni` is the canonical web source branch and has now been imported into `web/` without merging unrelated Git history.
- `origin/recover-local-stories` remains supplemental for story/test recovery only.
- `origin/feature/3d-mannequin` remains optional and intentionally outside core parity scope.

## Branch Family Status

| Branch Family | Representative Refs | Status | Backend Impact | Web Impact | Android Impact | Migration Action |
|---|---|---|---|---|---|---|
| Backend parity tasks | `codex/task-01` to `codex/task-17` | `Done` | Already represented in current APIs/tests | Indirect only | Indirect only | No wholesale merge. Keep as historical references. |
| Sprint finalization branches | `codex/task-05`, `codex/task-10`, `codex/sprint5-*` | `Superseded` | Runtime behavior already exceeds branch scope | None | None | No import required. |
| Legacy backend integration | `origin/backend-feature` | `Done` | Superseded by broader validation/auth/weather coverage in `backend-features` | None | Indirect only | Reference only. |
| Legacy Android/backend AI branch | `origin/FITGPT-AI_Applications` | `Superseded` | Local recommendation engine should not replace backend-managed AI routes | None | Older implementation patterns only | Reference only. |
| Android connection test branch | `origin/font-and-backend-connection-test` | `Superseded` | No missing backend capability | None | Current Retrofit/repository stack is newer | Reference only. |
| Early integration branch | `origin/sprint2integration` | `Superseded` | Historical auth/chat/recommendation concepts already covered | None | Historical only | Reference only. |
| Android test backfill | `testing-Muhammad`, `origin/testing-Muhammad` | `Partial` | No runtime gap found | None | Validator/unit-test ideas remain useful | Selective test backfill only. |
| Canonical web app | `origin/dieuni` | `Done` | Backend aliases and contracts aligned | Imported into `web/` and building | Drove Android parity additions | Continue using as main web parity source. |
| Older local web branch | `dieuni` | `Absorbed` | None | Behind remote canonical branch | None | Do not use as source of truth. |
| Earlier web foundation | `origin/nadeige-domain` | `Absorbed by origin/dieuni` | None | Covered by later `origin/dieuni` tree | None | Reference only. |
| Prototype dashboard | `origin/nadeige-dashboard` | `Reference-only` | No safe merge path | Prototype-only | None | Do not merge. |
| Story/test recovery | `origin/recover-local-stories` | `Still in Progress` | None | May still provide recovered story/test artifacts | None | Review selectively after core parity stabilization. |
| 3D mannequin workstream | `origin/feature/3d-mannequin` | `Optional` | Separate recommendation/rendering concerns | Separate UX workstream | Separate UX workstream | Keep isolated from core parity work. |
| Baseline branch | `main`, `origin/main` | `Superseded` | Older than current parity work | Older than current parity work | Older than current parity work | No direct migration action. |

## Current State Summary

- Backend:
  - Full backend suite passes on `backend-features`.
  - Stable auth alias support remains intact for `/login` and `/auth/login`.
  - Addeditive compatibility remains in place for `/weather/forecast` and `/recommendations/forecast`.
- Web:
  - `web/` now contains the imported React app from `origin/dieuni`.
  - Build passes on the imported app.
  - Auth, onboarding, profile avatar persistence, wardrobe favorites/archive handling, and current weather access are aligned to the current backend.
- Android:
  - `./gradlew testDebugUnitTest` passes.
  - Added parity surfaces for duplicate review, wardrobe rotation visibility, forecast planning, laundry insights, and recommendation transparency using existing repository/viewmodel patterns.

## Remaining Follow-Up

- Review `origin/recover-local-stories` for any story/test files still worth restoring on top of the imported web tree.
- Evaluate `origin/feature/3d-mannequin` as a separate product decision after core parity is stable.
- Expand Android and web UI tests around the newly added parity surfaces if those flows become release-critical.
