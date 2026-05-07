# Senior symposium readiness — FitGPT

Practical checklist for the day before and day of the demo. **Demo account credentials must be stored privately by the team — do not commit passwords or API keys.**

---

## 1. Final demo flow (suggested order)

1. **Open** [https://www.fitgpt.tech](https://www.fitgpt.tech) and briefly introduce the product.
2. **Sign in** with the team’s pre-seeded demo account (credentials kept offline).
3. **Wardrobe** — show existing items; **add one item**; **refresh** and confirm it persists.
4. **Dashboard** — generate **outfit recommendations** (rule-based engine; AI may augment when configured).
5. **AURA** — ask one short question; note **AI when the backend has Groq configured**, otherwise **graceful fallback messaging**.
6. **Android** — show [https://www.fitgpt.tech/download](https://www.fitgpt.tech/download) or a pre-opened APK; mention **sideload / unknown sources** only if asked.
7. **Close** with architecture: shared API, web + Android, deployed backend.

---

## 2. Day-before checklist

- Run **`scripts/smoke-test-production.sh`** (or the manual health check below).
- Confirm **GitHub Actions** green on `main`.
- Confirm **Render** service is healthy and env vars are set (team member with access).
- **Pre-seed** demo wardrobe and profile on the demo account; log in once and verify.
- **Download page**: open `/download`; tap **Download FitGPT Android APK**; confirm the file downloads.
- **Phone**: install APK on one Android device if possible; note **school Wi-Fi** may block GitHub or large downloads — plan **hotspot**.
- **iPhone Safari**: open the web app; scroll main flows; confirm **primary buttons are not clipped** (safe areas, zoom).
- **Screenshots**: capture hero, wardrobe, recommendations, AURA (or fallback), download page.
- **Screen recording**: 60–90 seconds of the happy path for backup projection.

---

## 3. Morning-of checklist

- Re-run **`GET https://fitgpt-backend-tdiq.onrender.com/health`** (expect **200**).
- Open **https://www.fitgpt.tech** and **https://www.fitgpt.tech/download**.
- Log in as demo user; spot-check wardrobe and one recommendation.
- Charge laptops and phones; bring **hotspot**; test **school Wi-Fi** early.
- Close unrelated tabs; set **Do Not Disturb**; test **HDMI / projector** once.

---

## 4. Production smoke test checklist

| Check | Action |
|--------|--------|
| Backend | `GET https://fitgpt-backend-tdiq.onrender.com/health` → **200** |
| Web | Open **https://www.fitgpt.tech** |
| Download | Open **https://www.fitgpt.tech/download** |
| Auth | Confirm **login** works |
| Wardrobe | Confirm **wardrobe loads** |
| Add item | Confirm **adding one item** works |
| Persist | Confirm item **persists after refresh** |
| Recommendations | Confirm **recommendations generate** |
| AURA | Confirm **AURA responds** or **fallback** is acceptable |
| APK link | Confirm **Android APK link** opens / downloads |
| Android install | If device available: **install** and open app |
| iPhone Safari | Confirm **layout** does not hide buttons |
| Network | Confirm **school Wi-Fi** or **hotspot** fallback |
| Artifacts | **Screenshots** + **60–90s recording** |

Automated helper (health only): `scripts/smoke-test-production.sh` from repo root.

---

## 5. Android APK checklist

- Public URL is documented on `/download` and points to the **symposium-demo-v1** GitHub release asset (verify the file name matches the live release).
- **Backup**: [GitHub release page](https://github.com/Muhammad7839/FitGPT/releases/tag/symposium-demo-v1) if a browser blocks the direct file URL.
- **Unknown sources**: users may need **Settings → Security → Install unknown apps** for the browser or file manager.
- **Manual follow-up**: If the team uploads a renamed APK (e.g. `FitGPT-Symposium-Demo.apk`), update `web/src/constants/symposiumRelease.js` and redeploy the web app so QR codes stay accurate.

---

## 6. iPhone Safari checklist

- Open **https://www.fitgpt.tech** (not only Chrome on desktop).
- Test **login**, **dashboard**, and **wardrobe** scroll regions.
- Confirm **fixed footers / chat bubble** do not cover primary actions.
- If something clips, **zoom out** or **rotate** once — document as a known quirk if it persists.

---

## 7. Cross-device test matrix

| Surface | Network | What to verify |
|---------|---------|----------------|
| Laptop + projector | Venue Wi-Fi | Web login, recommendations, slides |
| Android phone | Wi-Fi or hotspot | APK install, login, wardrobe list |
| iPhone Safari | Wi-Fi or hotspot | Web layout, login, scroll |
| Backup: recording only | Offline | Play 60–90s screen capture |

---

## 8. Demo account and data plan

- **One shared demo account** with a **small, realistic wardrobe** pre-loaded.
- **Passwords and secrets** live in the team’s private channel or password manager — **never** in the repo.
- **Optional**: second account for “sign up” only if time allows; default to login-only to reduce risk.

---

## 9. Backup plan for failures

| Failure | Before demo | If it happens | Fallback |
|---------|-------------|---------------|----------|
| Render cold start / 502 | Hit `/health` 2–3 min before; keep tab warm | “Spinning up — one moment” | Show screen recording; narrate architecture |
| Groq / AURA down | Know fallback copy | “Stylist uses rules + optional AI” | Show recommendations without chat |
| School Wi-Fi blocks GitHub | Test download on hotspot | “We’ll use the web app” | QR to `/download` or pre-copied APK on USB |
| Android install blocked | Document unknown-apps path once | Walk through Settings | Web-only demo |
| Safari layout bug | Test day before | Rotate / zoom | Use Android or laptop for that step |

---

## 10. What to demo live

- Web: login, wardrobe, add item, refresh, recommendations.
- Optional: AURA one prompt; Android install only if reliable on venue network.
- One slide or whiteboard: **three-tier architecture** (web, Android, FastAPI).

---

## 11. What to show with screenshots only

- Deep analytics charts if time is short.
- Edge cases (empty wardrobe, offline) unless they strengthen the story.
- Any feature that depends on **optional API keys** you did not verify that morning.

---

## 12. What not to overclaim

- **No** “fully trained personalized ML model” — classification uses a **pre-trained** on-device model; recommendations are **explainable rules** plus optional **LLM** assistance.
- **No** “complete virtual try-on” — the app uses **3D mannequin / outfit visualization**, not body scan try-on.
- **No** “AI does everything” — **human-in-the-loop** wardrobe and preferences matter.

---

## 13. Safe AI explanation (elevator version)

> “FitGPT combines **structured recommendation logic** with **AI-assisted** styling. Outfits are grounded in **your real wardrobe** and **weather**. **AURA** uses an LLM **when the backend is configured**; otherwise the app still works with **rule-based** suggestions.”

---

## 14. Security talking points

- **JWT auth**, password hashing, **rate limits** on auth endpoints.
- **CORS allowlist**, security headers, **no default secret** in production.
- **Secrets** only in deployment env — **not** in the client or repo.
- **OAuth client IDs** in mobile/web are **public** by design; **never** ship server secrets in APK or bundle.

---

## 15. Known risks

- **Cold starts** on free/low-tier hosting can add latency — pre-warm before the slot.
- **Optional integrations** (Groq, OpenWeather, Google OAuth) may be **degraded** if keys or quotas fail — frame as **graceful degradation**.
- **Sideloading** Android APKs is unfamiliar to some judges — keep **web app** as the primary demo path.

For each major risk, use the table in **§9**: *risk → before / during / fallback*.

---

## 16. Do not change before demo

- **No** dependency upgrades, **no** large refactors, **no** schema migrations.
- **No** last-minute **auth** or **production DB guard** changes.
- **No** force-push or history rewrite on `main`.
- If a copy or link must change, prefer **`symposiumRelease.js`** + docs only, then **redeploy web** and re-test `/download`.

---

## Quick command reference

```bash
# Backend health (expect HTTP 200)
curl -sS -o /dev/null -w "%{http_code}\n" https://fitgpt-backend-tdiq.onrender.com/health

# From repo root
./scripts/smoke-test-production.sh
```
