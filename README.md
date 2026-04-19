# FitGPT – AI-Powered Outfit Recommendation & Digital Wardrobe
## Overview
FitGPT is a full-stack application that helps users manage their wardrobe, generate outfit recommendations, and plan what to wear based on real-world context like weather and available clothing.
The goal of this project was to build something practical and consistent across platforms. Instead of treating web, mobile, and backend as separate systems, the focus was on creating a single source of truth for data, logic, and user experience.
---
## What This Project Demonstrates
- Designing and maintaining a shared API contract across web and mobile clients  
- Building a backend that owns business logic instead of duplicating it in clients  
- Handling real-world issues like authentication, environment differences, and state consistency  
- Managing multi-branch development and safely unifying divergent codebases  
- Delivering a system that works reliably across emulator, physical device, and deployed environments  
---
## Core Features
### User Experience
- Digital wardrobe with add, edit, and delete functionality  
- Outfit recommendations based on current wardrobe  
- Save outfits for reuse and plan outfits for future dates  
- Outfit history tracking  
- Manual outfit builder for custom combinations  
- 3D mannequin preview for visualizing outfits  
### Recommendation System
- Weather-aware outfit suggestions  
- Layering logic to ensure valid combinations  
- Conflict detection for incompatible items  
- Consistent recommendation behavior across web and Android  
### Cross-Platform Behavior
- Same backend logic used by both web and Android  
- Shared authentication and session handling  
- Consistent API responses and data models across clients  
---
## System Architecture
FitGPT consists of three main parts:
- React web application  
- Android application built with Jetpack Compose  
- FastAPI backend  
Both clients communicate with the backend through REST APIs.
The backend is responsible for:
- Authentication and session management  
- Wardrobe data storage  
- Recommendation logic  
- Outfit saving, planning, and history  
This design ensures that all core logic lives in one place, which prevents inconsistencies between platforms and simplifies maintenance.
---
## Tech Stack
### Frontend
- React  
- JavaScript  
- CSS  
### Mobile
- Kotlin  
- Jetpack Compose  
### Backend
- Python  
- FastAPI  
- SQLAlchemy  
### Networking and Tools
- Retrofit / OkHttp (Android)  
- Fetch API (Web)  
- Google Sign-In  
- OpenWeather API  
---
## Key Engineering Decisions
**Centralized Backend Logic**  
All recommendation and validation logic is handled by the backend to avoid duplication.
**API Contract Stability**  
Multiple endpoints support alias routes such as `/login` and `/auth/login` to maintain compatibility across clients.
**Environment-Aware Networking**  
Android dynamically switches between emulator routing (`10.0.2.2`), LAN access for physical devices, and production backend configuration.
**Session Persistence Strategy**  
Tokens are stored locally and only cleared on true authentication failure, not transient network or backend errors.
**Frontend Fallback Handling**  
Web mutations support safe fallback behavior with explicit flags so temporary backend failures do not silently lose user actions.
---
## Challenges and Solutions
**Google Sign-In Configuration**  
Required aligning client IDs across Android, backend, and web, along with correct SHA registration and environment setup.
**Branch Divergence**  
Multiple branches introduced conflicting implementations. The final solution used selective integration instead of full merges to preserve stability.
**API Mismatches**  
Differences between endpoints across platforms were resolved through alias routes and consistent response structures.
**Device Networking Issues**  
Emulator and physical devices required different backend routing strategies, handled through environment-based configuration.
---
## Running the Project Locally
### Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

Web

cd web
npm install
npm start

Android

* Open the project in Android Studio
* Let Gradle sync complete
* Run on an emulator or a physical device

Notes:

* Emulator uses 10.0.2.2
* Physical device uses your machine’s LAN IP

⸻

Demo Flow

* Sign in or create an account
* Add wardrobe items
* Generate an outfit recommendation
* View the outfit in 3D
* Build a custom outfit
* Save or plan the outfit

⸻

Future Work

* Improve personalization based on long-term usage
* Expand recommendation logic for style preferences
* Refine UI and onboarding for a faster first-time experience
