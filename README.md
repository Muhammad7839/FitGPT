# FitGPT

FitGPT is a cross-platform AI wardrobe assistant. It helps users organize their clothing, get daily outfit recommendations based on weather and personal style, and track what they wear over time. The app is available as a web app and an Android app, both backed by the same FastAPI server.

---

## Tech Stack

**Web Frontend**
- React 19 with React Router 7
- Three.js and React Three Fiber for 3D outfit preview
- TensorFlow.js with MobileNet v2 for clothing classification
- Recharts for analytics

**Backend**
- FastAPI with Python
- SQLAlchemy 2.0 as the ORM
- PostgreSQL in production, SQLite for local development
- JWT and bcrypt for authentication, Google OAuth for social login
- Groq API with Llama 3.1 8B for the AURA AI chatbot
- OpenWeather API for live weather data

**Android**
- Kotlin with Jetpack Compose
- Retrofit for HTTP calls to the shared backend

**Deployment**
- Frontend: Vercel
- Backend: Render (with PostgreSQL)
- CI: GitHub Actions

---

## Live App

The production app is live at: https://fitgpt.tech

---

## How to Run the Backend Locally

1. Go into the backend folder:
   ```
   cd backend
   ```

2. Activate the virtual environment:
   ```
   source venv/bin/activate
   ```
   On Windows use: `venv\Scripts\activate`

3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

4. Copy the environment variable template and fill in your values:
   ```
   cp .env.example .env
   ```

5. Start the server:
   ```
   uvicorn app.main:app --reload
   ```

The API will be available at http://localhost:8000. The interactive docs are at http://localhost:8000/docs.

---

## How to Run the Web Frontend Locally

1. Go into the web folder:
   ```
   cd web
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm run dev
   ```

The app will be available at http://localhost:5173 by default.

Make sure the backend is running locally first, and that `FRONTEND_URL` in your `.env` is set to the correct address.

---

## How to Run the Android App

Open the project root in Android Studio. Android Studio will import the Gradle project automatically.

1. Wait for Gradle sync to finish.
2. Connect a device or start an emulator.
3. Click Run or press Shift+F10.

You can also build from the command line:
```
./gradlew assembleDebug
```

The Android app talks to the same backend as the web app. Update the base URL in the network config to point to your local backend if testing locally.

---

## Environment Variables

Create a `.env` file in the `backend/` folder. Use `backend/.env.example` as the template. The required variables are:

| Variable | Description |
|---|---|
| DATABASE_URL | PostgreSQL connection string |
| SECRET_KEY | Secret key for signing JWT tokens |
| GROQ_API_KEY | API key from console.groq.com |
| GMAIL_ADDRESS | Gmail address used for sending reset emails |
| GMAIL_APP_PASSWORD | Gmail app password (not your account password) |
| FRONTEND_URL | URL of the frontend, used for CORS (e.g. http://localhost:3000) |
| OPENWEATHER_API_KEY | API key from openweathermap.org |

Never commit your `.env` file. It is listed in `.gitignore`.

---

## Testing and GitHub Actions

**Backend tests** use pytest. To run them:
```
cd backend
source venv/bin/activate
pytest tests/
```
There are 185+ backend tests covering authentication, recommendations, wardrobe management, and API routes.

**Web tests** use Jest. To run them:
```
cd web
npm test
```
There are 617 web tests covering components, hooks, and integration flows.

**GitHub Actions** runs both test suites automatically on every push to `main` and on pull requests. The workflow files are in `.github/workflows/`.

---

## Repository Structure

```
FitGPT/
??? app/              # Android app (Kotlin + Jetpack Compose)
??? backend/          # FastAPI backend (Python)
?   ??? app/          # Routes, models, schemas, auth logic
?   ??? database/     # SQL scripts for tables, indexes, and views
?   ??? tests/        # pytest test suite
?   ??? .env.example  # Environment variable template
?   ??? requirements.txt
??? web/              # React web frontend
??? README.md
```
