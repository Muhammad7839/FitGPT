# Weekly Planner

## Overview
The Weekly Planner allows users to assign outfits to specific days of the week in advance. This reduces daily decision fatigue and provides a structured way to plan ahead.

The planner works alongside saved outfits — outfits must be saved before they can be added to the planner.

---

## Description
The planner displays a 7-day view from Sunday to Saturday. Each day can hold one or more planned outfits.

The current week is shown by default. Users can assign, replace, or remove outfits for any day.

Planner entries are linked to saved outfits. If a user plans an outfit directly from a recommendation, the outfit is saved first (if not already saved), then added to the planner.

---

## System Behavior
- Each day can contain no outfit or multiple planned outfits
- Planning an outfit assigns a `saved_outfit_id` to that day
- If planning from a recommendation, the outfit is saved first if not already saved

Editing and removing:
- Adding an outfit to a day that already has one prompts a replacement confirmation
- Edit replaces the existing planned outfit with another saved outfit
- Remove clears the planned outfit for that day

---

## Recommendation Integration
The planner influences recommendation generation to reduce redundancy:
- Outfits planned for the current day are not re-suggested as new recommendations
- Outfits planned for upcoming days may be deprioritized to encourage variety

This ensures recommendations remain useful and do not conflict with the user's planned schedule.

---

## Quick Planning Mode

### Description
Quick planning mode provides a simplified workflow for assigning outfits to upcoming days with minimal steps. Users can select from recommended or saved outfits and add them to the planner in a few clicks, reducing the time required to plan a full week.

### System Behavior
When a user opens quick planning mode:
- Recommended and saved outfits are presented as selectable options
- Selecting an outfit and a day assigns it to the planner immediately
- No additional confirmation steps are required unless a conflict exists

If the selected day already has a planned outfit:
- The system prompts the user to confirm replacing the existing outfit
- If confirmed, the new outfit replaces the existing one
- If cancelled, the existing outfit remains unchanged

Outfits assigned through quick planning mode appear in the weekly planner the same way as outfits added through the standard flow.

---

## Trip Packing List

### Description
Users can generate a packing list for an upcoming trip by providing the destination and travel dates. The system uses destination weather data and the user's wardrobe to recommend what clothing to bring, accounting for trip length and expected conditions.

### System Behavior
When a user inputs trip details (destination and dates):
- The system retrieves weather forecast data for the destination and travel period
- A packing list is generated based on expected conditions, trip duration, and the user's wardrobe

When the packing list is generated:
- Clothing suggestions reflect the expected weather conditions at the destination
- Recommended quantities are based on trip length (e.g., number of days)
- Suggestions reference items from the user's existing wardrobe where possible

When forecast data is unavailable for the destination:
- The system generates a general packing list based on the destination's typical climate or falls back to neutral recommendations
- The user is informed that live forecast data was unavailable

When the packing list is displayed:
- The user can see recommended clothing items grouped by category
- Quantities and any weather-specific notes are shown alongside each item
