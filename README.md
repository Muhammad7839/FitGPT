# FitGPT

FitGPT is a cross-platform wardrobe management and outfit recommendation system.
The goal of FitGPT is to reduce decision fatigue by helping users organize their clothing
and receive clear, explainable outfit suggestions.

This repository contains both the Android app and the Web app, developed in parallel
by different team members while following the same product goals and UX design.

---

## Repository Structure

```text
FitGPT/
│
├── app/                 # Android application (Jetpack Compose)
│   ├── src/
│   ├── build.gradle.kts
│   └── proguard-rules.pro
│
├── web/                 # Web frontend (React or similar)
│   └── README.md
│
├── gradle/              # Gradle wrapper files
├── build.gradle.kts     # Project-level Gradle configuration
├── settings.gradle.kts
├── gradle.properties
├── gradlew
├── gradlew.bat
└── README.md            # Project overview (this file)
└── README.md            # Project overview
```

---

## Android Application (app/)

The Android app is built using modern Android development practices.

### Tech Stack
- Kotlin
- Jetpack Compose
- MVVM architecture
- Navigation Compose
- StateFlow
- Fake repository (temporary, will be replaced with Room database)

### Current Features
- View wardrobe items
- Add clothing items
- Edit clothing items
- Delete clothing items
- Filter wardrobe by season
- Filter wardrobe by comfort level
- Basic AI explanation placeholder for recommendations
- Navigation between screens

### Screens Implemented
- Wardrobe Screen
- Add Item Screen
- Edit Item Screen
- Recommendation Screen (placeholder)

---

## Web Application (web/)

The web folder is reserved for the frontend team.

### Web Team Responsibilities
- Implement the same features as the Android app
- Follow shared UX documentation and Figma designs
- Match screen names, flows, and behavior with Android
- Build a responsive web-first experience

---

## Shared Product Goals

Both Android and Web versions must support:
- Wardrobe management
- Outfit recommendations
- Explainable suggestions
- Accessibility-friendly UX
- Consistent screen flow and terminology

---

## Collaboration Guidelines

- Android work stays inside the `app/` folder
- Web work stays inside the `web/` folder
- Do not modify the other platform’s folder
- Use Git branches and pull requests for changes
- Keep commits small and clearly named
- Sync frequently to avoid merge conflicts

---

## Project Status

This is an active senior project.
The architecture and features will evolve during development.

