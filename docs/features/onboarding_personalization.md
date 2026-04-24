# Onboarding & Personalization

## Overview
The onboarding system guides new users through a short setup flow to configure basic preferences for outfit recommendations. It runs automatically on first login and is designed to be quick and non-blocking — all steps except the introduction are optional.

---

## Guided Onboarding

### System Behavior
When a new user logs in for the first time:
- The onboarding flow is displayed automatically
- Users are guided through a sequence of setup steps
- Each completed step advances to the next

If a step is skipped:
- Onboarding continues without blocking progress
- Default values are applied where necessary

---

## Body Type Personalization

### Description
Users can select a body type from a predefined set of options during onboarding. The selection is stored in the user's profile and used by the recommendation engine during outfit scoring.

### System Behavior
- Selected body type is saved to the user's profile
- If skipped, a default body type value is assigned
- Users can update their body type later in profile settings

---

## Quick Preference Setup

### Description
Users configure core preferences during onboarding that personalize outfit recommendations. These include lifestyle, personal style, and comfort level.

### System Behavior
When onboarding is completed:
- Selected preferences are saved to the user's profile
- Preferences are used to personalize future recommendations

If skipped, default values are applied and recommendations are still generated.

### Preference Persistence
- Saved preferences are retrieved on subsequent sessions
- Users can update preferences through profile settings at any time

---

## Skippable Preferences

### Description
All preference questions during onboarding are optional. Users can skip any step and access the app immediately. Default values ensure the recommendation engine can function without user input.

Optional steps include:
- Style preference
- Comfort preference
- Lifestyle preference
- Body type

Default values applied when skipped:
- Style: neutral / mixed
- Comfort: balanced
- Lifestyle: casual

### System Behavior
When a user skips one or more preference questions:
- The system assigns predefined default values for any missing fields
- Onboarding continues and completes without interruption
- The user gains full access to all features

When the recommendation engine runs with missing preference data:
- Default values are used in place of user-provided values
- Valid outfit suggestions are always produced

When a user later updates their preferences:
- The updated values replace the defaults immediately
- All future recommendations use the updated values

### Recommendation Integration
Default preferences allow the system to generate balanced recommendations without requiring user input. Updated preferences immediately influence future recommendations.

---

## Profile Summary

### Description
Users can view a summary of their saved profile information and personalization settings from the profile page. This allows users to review the preferences that are actively influencing their outfit recommendations.

The profile summary displays:
- Style preference
- Comfort preference
- Lifestyle preference
- Body type
- Any other personalization settings stored in the user's profile

### System Behavior
When a user opens the profile page:
- Their saved preferences are retrieved and displayed
- All values that have been set are shown clearly

If preferences have been set during onboarding or updated later:
- The profile summary reflects the current stored values

When a user updates their preferences and saves the changes:
- The profile summary updates immediately to reflect the new values
- The recommendation engine uses the updated values going forward

---

## Comfort Preferences

### Description
Users can define personal comfort preferences to help the recommendation engine prioritize outfits that align with how they like their clothing to feel. Comfort preferences may include warmth level, fit type, layering tolerance, and fabric breathability.

Comfort preference options include:
- **Warmth level** — preference for warmer or lighter clothing
- **Fit type** — preference for fitted, relaxed, or oversized clothing
- **Layering tolerance** — preference for single-layer outfits or layered combinations
- **Breathability** — preference for breathable or insulating fabrics

These preferences can be set during onboarding or updated later through profile settings.

### System Behavior
When a user defines comfort preferences:
- The selected values are stored in the user's profile
- Preferences are retrieved and applied when outfit recommendations are generated

If comfort preferences are not defined:
- The system falls back to default comfort values (balanced)
- Recommendations are still generated without interruption

### Recommendation Integration
When generating outfit recommendations:
- Clothing items are evaluated against the user's stored comfort preferences
- Outfits that align with those preferences receive a higher recommendation score
- Comfort preferences contribute to recommendation explanation text (see [Comfort Reasoning](recommendation_engine.md#comfort-reasoning))
