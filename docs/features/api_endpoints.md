# API Endpoints

## Overview
The FitGPT backend runs on FastAPI (port 8000). All endpoints are available under two router prefixes for compatibility — root (`/`) and auth-prefixed (`/auth/`). Auth-required endpoints expect a Bearer token in the `Authorization` header.

Base URL: `http://localhost:8000`

---

## Authentication

### POST `/auth/register`
Register a new user with email and password.

**Auth required:** No

**Request body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "id": 1,
  "email": "string",
  "body_type": "unspecified",
  "lifestyle": "casual",
  "comfort_preference": "medium",
  "onboarding_complete": false
}
```

**Errors:** `400` — email already registered

---

### POST `/auth/login`
Log in with email and password.

**Auth required:** No

**Request body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "access_token": "string",
  "token_type": "bearer"
}
```

**Errors:** `401` — incorrect credentials

---

### POST `/auth/google/callback`
Authenticate using a Google ID token. Creates a new account or links to an existing email account.

**Auth required:** No

**Request body:**
```json
{
  "id_token": "string"
}
```

**Response:**
```json
{
  "access_token": "string",
  "token_type": "bearer"
}
```

**Errors:** `401` — invalid token or missing email/google_id

---

### GET `/auth/me`
Get the currently authenticated user's profile.

**Auth required:** Yes

**Response:**
```json
{
  "id": 1,
  "email": "string",
  "body_type": "unspecified",
  "lifestyle": "casual",
  "comfort_preference": "medium",
  "onboarding_complete": false
}
```

**Errors:** `401` — invalid or missing token

---

### PUT `/me/profile`
Update the authenticated user's profile fields.

**Auth required:** Yes

**Request body (all fields optional):**
```json
{
  "body_type": "athletic",
  "lifestyle": "casual",
  "comfort_preference": "medium",
  "onboarding_complete": true
}
```

**Body type values:** `rectangle`, `athletic`, `curvy`, `petite`, `tall`, `unspecified`

**Response:** Updated `UserResponse` object

---

### POST `/auth/forgot-password`
Request a password reset email.

**Auth required:** No

**Request body:**
```json
{
  "email": "string"
}
```

**Response:**
```json
{
  "message": "If an account exists, a reset link has been sent."
}
```

**Notes:** Always returns success regardless of whether the email exists. Reset tokens expire after 1 hour. Requires `GMAIL_ADDRESS`, `GMAIL_APP_PASSWORD`, and `FRONTEND_URL` env vars.

---

### POST `/auth/reset-password`
Reset a user's password using a reset token.

**Auth required:** No

**Request body:**
```json
{
  "token": "string",
  "new_password": "string"
}
```

**Response:**
```json
{
  "message": "Password has been reset successfully."
}
```

**Errors:** `400` — token invalid, expired, already used, or user not found

---

## Wardrobe

### GET `/wardrobe/items`
Get all active wardrobe items for the authenticated user.

**Auth required:** Yes

**Response:**
```json
[
  {
    "id": 1,
    "name": "string",
    "category": "top",
    "color": "black",
    "fit_type": "regular",
    "style_tag": "casual",
    "image_url": "string | null"
  }
]
```

**Category values:** `top`, `bottom`, `shoes`, `outerwear`, `accessory`
**Color values:** `black`, `white`, `gray`, `beige`, `red`, `blue`, `green`, `yellow`, `purple`, `orange`
**Fit type values:** `slim`, `regular`, `oversized`
**Style tag values:** `casual`, `sporty`, `formal`, `street`

---

### POST `/wardrobe/items`
Add a new clothing item to the authenticated user's wardrobe.

**Auth required:** Yes

**Request body:**
```json
{
  "name": "string",
  "category": "top",
  "color": "black",
  "fit_type": "regular",
  "style_tag": "casual",
  "image_url": "string | null"
}
```

**Response:** `ClothingItemResponse` (same shape as GET items array element)

---

### PUT `/wardrobe/items/{item_id}`
Update an existing clothing item. Full object required.

**Auth required:** Yes

**Path params:** `item_id: int`

**Request body:** Same as POST `/wardrobe/items`

**Response:** Updated `ClothingItemResponse`

**Errors:**
- `404` — item not found
- `403` — item does not belong to the authenticated user

---

### DELETE `/wardrobe/items/{item_id}`
Soft-delete a clothing item (sets `is_deleted = true`).

**Auth required:** Yes

**Path params:** `item_id: int`

**Response:**
```json
{
  "detail": "Item deleted successfully"
}
```

**Errors:**
- `404` — item not found
- `403` — item does not belong to the authenticated user

---

## Recommendations

### GET `/recommendations`
Generate outfit recommendations using the local scoring algorithm.

**Auth required:** Yes

**Response:**
```json
{
  "body_type": "string",
  "lifestyle": "string",
  "outfits": [
    {
      "top": { "id": 1, "name": "string", "category": "top", "color": "black", "fit_type": "regular", "style_tag": "casual" },
      "bottom": { ... },
      "shoes": { ... },
      "outerwear": null,
      "accessory": null,
      "score": 7,
      "confidence": 85.0,
      "reason": "string"
    }
  ]
}
```

**Scoring factors:**
- Style matching (lifestyle → outfit style: +3 exact, +2 partial)
- Fit matching (athletic body type + slim/athletic fit: +2)
- Color harmony (neutral colors: +2; warm-warm or cool-cool: +2; otherwise: +1)

Returns top 3 outfits sorted by score. Returns empty `outfits` list if wardrobe is empty.

---

### POST `/recommendations/ai`
Generate AI outfit recommendations using Groq (llama-3.1-8b-instant).

**Auth required:** No

**Request body:**
```json
{
  "items": [
    {
      "id": "string",
      "name": "string",
      "category": "string",
      "color": "string",
      "fit_type": "string",
      "style_tag": "string"
    }
  ],
  "context": {
    "weather_category": "mild",
    "time_category": "work hours",
    "occasion": "daily",
    "body_type": "rectangle",
    "style_preferences": []
  }
}
```

**Weather category values:** `cold`, `cool`, `mild`, `warm`, `hot`

**Response:**
```json
{
  "source": "ai",
  "outfits": [
    {
      "item_ids": ["string"],
      "explanation": "string"
    }
  ]
}
```

**Fallback response (Groq unavailable):**
```json
{
  "source": "fallback",
  "outfits": []
}
```

**Notes:**
- `image_url` is stripped by the frontend before sending
- Hallucinated item IDs are filtered server-side
- Categories are deduplicated (first item per category kept)
- Outfits with fewer than 2 items are discarded
- Returns up to 3 outfits
- Requires `GROQ_API_KEY` env var

---

## Dashboard

### GET `/dashboard/context`
Get current weather context for the dashboard.

**Auth required:** Yes

**Response:**
```json
{
  "weather": {
    "temperature": 72.5,
    "condition": "Clear",
    "location": "Farmingdale",
    "suggestion": "Comfortable weather"
  }
}
```

**Suggestion values:**
- `< 50°F` → `"Wear a jacket"`
- `> 80°F` → `"Light clothing"`
- Otherwise → `"Comfortable weather"`

**Fallback (API unavailable):**
```json
{
  "weather": {
    "temperature": null,
    "condition": "Unavailable",
    "location": "Unknown",
    "suggestion": "Weather service unavailable"
  }
}
```

**Notes:** Default city is `"Farmingdale"`. Requires `OPENWEATHER_API_KEY` env var.

---

## Root

### GET `/`
Health check.

**Auth required:** No

**Response:**
```json
{
  "message": "FitGPT backend is running"
}
```

---

## Frontend API Modules

The frontend uses local storage as the primary data store. Backend calls are best-effort — failures are caught silently and local state is preserved.

### Storage-Only Modules (No Backend Calls)

| Module | Storage Key | Purpose |
|---|---|---|
| `savedOutfitsApi.js` | `fitgpt_saved_outfits_v1` | Save/list/remove outfit combinations |
| `outfitHistoryApi.js` | `fitgpt_outfit_history_v1` | Record/list/clear worn outfits |
| `plannedOutfitsApi.js` | `fitgpt_planned_outfits_v1` | Plan/list/remove planned outfits |
| `profileApi.js` | `fitgpt_profile_v1` | Save/read profile draft |

### Backend-Calling Modules

| Module | Endpoints Used |
|---|---|
| `authApi.js` | `POST /auth/login`, `POST /auth/register`, `GET /auth/me`, `POST /auth/google/callback` |
| `wardrobeApi.js` | `GET /wardrobe/items`, `POST /wardrobe/items`, `PUT /wardrobe/items/{id}`, `DELETE /wardrobe/items/{id}` |
| `recommendationsApi.js` | `POST /recommendations/ai` |
| `weatherApi.js` | Open-Meteo (external, no backend proxy) |

### Saved Outfit Record Shape
```json
{
  "saved_outfit_id": "uuid",
  "items": ["item_id_1", "item_id_2"],
  "item_details": [...],
  "source": "recommended",
  "created_at": "ISO string",
  "outfit_signature": "md5_hash"
}
```

### Outfit History Record Shape
```json
{
  "history_id": "uuid",
  "item_ids": ["item_id_1", "item_id_2"],
  "worn_at": "ISO string",
  "source": "recommendation",
  "context": {},
  "confidence_score": 85.0
}
```

### Planned Outfit Record Shape
```json
{
  "planned_id": "uuid",
  "item_ids": ["item_id_1", "item_id_2"],
  "item_details": [...],
  "planned_date": "ISO date string",
  "occasion": "string",
  "notes": "string",
  "created_at": "ISO string",
  "outfit_signature": "md5_hash"
}
```
