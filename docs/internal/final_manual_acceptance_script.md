# Final Manual Acceptance Script (Emulator + Physical Phone)

Purpose: run one exact end-to-end acceptance pass for FitGPT before release.

## 1. Preflight

1. Start backend:
   - `cd /Users/muhammad/AndroidStudioProjects/FitGPT/backend`
   - `source .venv/bin/activate`
   - `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
2. Verify backend:
   - Open `http://127.0.0.1:8000/docs` and confirm it loads.
3. Build Android debug APK once:
   - `cd /Users/muhammad/AndroidStudioProjects/FitGPT`
   - `./gradlew :app:assembleDebug`
4. Build web app once:
   - `cd /Users/muhammad/AndroidStudioProjects/FitGPT/web`
   - `npm install`
   - `npm run build`

## 2. Network Setup Rules

1. Emulator uses `http://10.0.2.2:8000`.
2. Physical phone uses host LAN IP, for example `http://192.168.1.25:8000`.
3. For physical phone, backend and phone must be on the same Wi-Fi network.
4. If physical phone cannot hit backend, allow inbound 8000 in local firewall.

## 3. Emulator Acceptance Run (Exact Click Path)

1. Launch app on emulator.
2. Welcome screen:
   - Tap `Continue`.
3. Login screen:
   - Enter valid test account.
   - Tap `Sign In`.
   - Expected: no network error; navigates to `Home`.
4. Home tab:
   - Confirm Weather card appears with valid state (`Loading`, `Using location`, `Permission needed`, city/weather value, or fallback text).
   - Confirm wardrobe gaps and underused rotation insights render without crashing.
   - Tap `Get Outfit Recommendation`.
5. Recommend tab:
   - Tap recommendation action.
   - Expected: recommendation cards render with explanation, source/fallback label, and recommendation context badges.
6. Wardrobe tab:
   - Confirm items list loads.
   - Search for a known item name.
   - Open filters, apply color + type + season, then clear filters.
   - Confirm duplicate review card loads and scanning does not error.
7. Add item flow:
   - Tap floating `+`.
   - Tap `Add Photo`.
   - Choose `Take Photo` and capture one image.
   - Fill required metadata and tap `Save`.
   - Repeat once with gallery multi-select and save.
   - Expected: successful toast/message and item(s) visible in Wardrobe.
8. Edit item flow:
   - Open one item.
   - Change at least one metadata field (for example `clothing_type` or `style_tags`).
   - Save and verify updated value appears.
9. Favorites:
   - From Wardrobe, mark one item as favorite.
   - Open `More` -> `Favorites`.
   - Expected: item appears.
10. Saved outfits:
    - Save one recommendation.
    - Open `More` -> `Saved Outfits`.
    - Expected: saved outfit appears.
11. History:
    - Mark one recommendation as worn.
    - Open `More` -> `History`.
    - Expected: entry appears; analytics tab loads; laundry tab shows reuse-based insight cards.
12. Plans:
    - Open `More` -> `Plans`.
    - Use date picker to choose a date.
    - Save a plan and verify list refresh.
    - Open the `Forecast` tab and load tomorrow's outfit.
    - Expected: forecast outfit explanation, weather context, and save action render.
13. Profile:
    - Open `Profile` tab.
    - Tap avatar/photo action and upload image.
    - Save profile.
    - Force close + reopen app.
    - Expected: avatar and profile values persist.
14. Settings:
    - Open `More` -> `Settings`.
    - Switch theme `Dark -> Light -> Dark`.
    - Expected: theme changes immediately and persists after restart.
15. Chat:
    - Open `More` -> `Chat`.
    - Send a prompt.
    - Expected: reply appears, with fallback behavior if provider unavailable.
16. Bottom navigation reliability:
    - Tap each tab repeatedly: `Home`, `Wardrobe`, `Recommend`, `Profile`.
    - Expected: always returns to each tab root without loop/stuck behavior.
17. Logout/login persistence:
    - Logout.
    - Login again with same account.
    - Confirm wardrobe/profile/avatar/settings data still present.

## 4. Web Acceptance Run (Exact Browser Path)

1. Start the web app against the same backend:
   - `cd /Users/muhammad/AndroidStudioProjects/FitGPT/web`
   - `npm start`
2. Open the local web URL in a browser.
3. Auth:
   - Register a new user.
   - Expected: user lands in onboarding or dashboard, not back on a dead-end auth screen.
   - Logout and log back in.
4. Onboarding:
   - Complete onboarding once.
   - Expected: onboarding completion persists and does not re-run before login.
5. Dashboard:
   - Confirm dashboard loads recommendations, weather state, and wardrobe/rotation insight cards.
6. Wardrobe:
   - Add or edit an item.
   - Toggle favorite and archive state.
   - Confirm duplicate review modal can open after scan-triggering flows.
7. Plans:
   - Open plans and verify upcoming weather planner plus trip packing planner render.
8. History:
   - Confirm history, analytics, and laundry tabs all render.
9. Profile:
   - Upload an avatar image.
   - Refresh the browser.
   - Expected: avatar persists via backend profile state.
10. Chat:
   - Send a message and confirm the assistant responds without exposing internal system-only messages.

## 5. Physical Phone Acceptance Run (Exact Click Path)

1. Set `API_LAN_BASE_URL` in `gradle.properties` to your LAN IP (example `http://192.168.1.25:8000/`).
2. Install/run app on phone.
3. Repeat Section 3 steps 1-17 exactly.
4. Expected: same behavior as emulator, including login, upload, duplicate review visibility, forecast planner, and recommendations.

## 6. Pass/Fail Exit Criteria

1. PASS if all steps in Sections 3, 4, and 5 complete without crash and all expected states appear.
2. FAIL if any of these occur:
   - login network error while backend is reachable
   - upload state gets stuck or save action disappears
   - tab press does not restore root
   - profile avatar fails to persist after restart
   - recommendations do not return explanation/source info
   - duplicate review or forecast planner surfaces error on initial load
   - web onboarding loops or profile avatar does not persist after refresh

## 7. Fast Triage Commands

1. Backend logs:
   - run backend with uvicorn output visible.
2. Android logs:
   - `adb logcat | rg -i "fitgpt|retrofit|okhttp|crash|exception"`
3. Backend health check:
   - `curl http://127.0.0.1:8000/docs`
4. Emulator connectivity check:
   - `adb shell ping -c 1 10.0.2.2`
5. Web build check:
   - `cd /Users/muhammad/AndroidStudioProjects/FitGPT/web && npm run build`
