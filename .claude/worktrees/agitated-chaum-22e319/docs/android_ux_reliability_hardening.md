# Android UX and Reliability Hardening

## Scope
- Branding refresh for splash/onboarding and header logo
- Shared background readability tuning for light and dark themes
- Top-level tab navigation reliability fixes
- Clearer weather/location failure states on dashboard
- Better AURA live-session continuity and starter prompts
- Safer photo auto-fill heuristics with stronger manual confirmation
- Responsive planned-outfit action layout on narrow screens

## Added Resources
- `app/src/main/res/drawable-nodpi/fitgpt_splash_brand.png`
  - Full splash artwork used for splash and onboarding branding.
- `app/src/main/res/drawable-nodpi/fitgpt_header_logo.png`
  - Cropped center-emblem version used in the top-left app header.

## Key Behavior Changes
- Top-level tab taps now navigate to the tab root using the graph start destination instead of broad graph popping.
- Secondary screens still use the back arrow pattern; bottom navigation remains top-level only.
- Dashboard weather copy now distinguishes:
  - permission missing
  - detected location available but weather provider unavailable
  - stale last-known weather snapshot
- AURA fallback chat keeps better live-session continuity for style asks such as "I want to go outside" even when the provider is unavailable.
- Add-item auto-fill now treats filename guesses as draft guidance, prefers bitmap color extraction for color, and asks for explicit category confirmation when confidence is low.
- Planned-outfit cards keep primary actions horizontal and move `Remove` to a lower-priority full-width row on smaller widths.

## Environment Verification
- Live weather still requires the backend environment variable `OPENWEATHER_API_KEY`.
- In this workspace shell, `OPENWEATHER_API_KEY` is currently unset.
- Result: Android now explains provider-side weather failure more accurately, but code changes alone will not restore live weather until that key is configured in the backend runtime.

## Verification Commands
- Android unit tests:
  - `./gradlew testDebugUnitTest`
- Targeted backend AURA fallback tests:
  - `cd backend && ./.venv/bin/pytest tests/test_chat_aura.py`
- Targeted Android instrumentation navigation test:
  - `./gradlew connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.fitgpt.app.ui.common.FitGptScaffoldNavigationTest`

## Current Verification Status
- Android unit tests passed locally.
- Targeted backend AURA tests passed locally.
- Targeted Android instrumentation build completed, but execution could not run because no device or emulator was connected.
