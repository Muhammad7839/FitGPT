# FitGPT Documentation

This folder contains all product and technical documentation for FitGPT, organized into two sections.

---

## `features/` — Product & Feature Docs

Describes what the app does and how each part of the system works. Start here if you're new to the codebase or want to understand a specific feature.

| File | Description |
|------|-------------|
| [system_overview.md](features/system_overview.md) | High-level overview of the full FitGPT system — what it is, how the parts connect, and the design goals |
| [architecture.md](features/architecture.md) | Technical architecture: web, Android, and backend layers, data flow, and API contract |
| [authentication.md](features/authentication.md) | Auth flow, JWT handling, Google OAuth, password reset, and security posture |
| [api_endpoints.md](features/api_endpoints.md) | Full reference for all backend REST endpoints with request/response shapes |
| [recommendation_engine.md](features/recommendation_engine.md) | How outfit recommendations are generated, scored, and personalized |
| [ai_logic.md](features/ai_logic.md) | AI features: AURA chatbot, Groq LLM integration, receipt OCR, and on-device image classification |
| [dashboard.md](features/dashboard.md) | Dashboard layout, outfit card rendering, weather context, and feedback flow |
| [wardrobe_management.md](features/wardrobe_management.md) | Wardrobe CRUD, bulk upload, tag suggestions, duplicate detection, and storage model |
| [outfit_preview.md](features/outfit_preview.md) | Outfit preview, 3D mannequin viewer, drag-and-drop builder |
| [planner.md](features/planner.md) | Weekly planner, trip packing planner, planning calendar, and forecast-aware suggestions |
| [onboarding_personalization.md](features/onboarding_personalization.md) | Onboarding flow, style/occasion/comfort preferences, and how they feed into recommendations |
| [user_engagement.md](features/user_engagement.md) | Feedback learning, wear history, rotation insights, and wardrobe gap detection |
| [accessibility.md](features/accessibility.md) | Accessibility features: high-contrast themes, large text mode, keyboard navigation |
| [weather_and_time_context.md](features/weather_and_time_context.md) | How weather and time-of-day context are fetched, normalized, and applied to recommendations |

---

## `internal/` — Team & Process Docs

Records of audits, testing checklists, branch history, and platform-specific hardening notes. Reference these for team process and release validation — not required reading to understand the product.

| File | Description |
|------|-------------|
| [AUDIT_REPORT.md](internal/AUDIT_REPORT.md) | Full-codebase audit report — bugs found, security fixes, test gaps, and follow-up items |
| [AUDIT_LOG.md](internal/AUDIT_LOG.md) | Step-by-step running log of the audit process |
| [features_checklist.md](internal/features_checklist.md) | Complete checklist of implemented features across web, Android, and backend |
| [branch_validation_checklist.md](internal/branch_validation_checklist.md) | Verification commands used to harden and validate branches before merging |
| [branch_comparison_summary.md](internal/branch_comparison_summary.md) | History of branch consolidation — what each branch contained and how they were unified |
| [web_android_parity_matrix.md](internal/web_android_parity_matrix.md) | Feature-by-feature parity matrix between the web app and Android app |
| [android_ux_reliability_hardening.md](internal/android_ux_reliability_hardening.md) | Android-specific UX reliability fixes, edge cases, and emulator/device testing notes |
| [final_manual_acceptance_script.md](internal/final_manual_acceptance_script.md) | End-to-end manual acceptance test script for pre-release validation |
