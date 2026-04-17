# Weather & Time Context

## Overview
Outfit recommendations are adjusted based on current weather conditions and time of day. Both factors influence recommendation scoring to ensure suggested outfits are practical and appropriate without restricting available options.

---

## Weather-Aware Recommendations

### Description
The system categorizes weather into five temperature ranges and uses them to influence outfit scoring.

| Category | Temperature |
|---|---|
| Cold | ≤ 40°F |
| Cool | 41 – 55°F |
| Mild | 56 – 70°F |
| Warm | 71 – 85°F |
| Hot | ≥ 86°F |

Users can manually override the detected weather category from the recommendation interface.

### System Behavior
When generating recommendations:
- Current weather is retrieved based on user location
- The temperature is mapped to one of the five categories
- The detected category and temperature are displayed to the user

If the weather API fails or location is unavailable:
- The system defaults to a neutral state (mild or no weather context)
- Recommendations continue without interruption
- A message indicates that weather is unavailable

Manual override:
- Users can select a different weather category from the interface
- A "Use auto-detect" option restores automatic behavior
- The override persists for the session or until changed

### Recommendation Integration
Weather adjusts recommendation scores but does not fully exclude items.
- Cold / cool → prioritizes outerwear, long pants, layered pieces
- Warm / hot → prioritizes lighter clothing (short sleeves, shorts, breathable items)
- Mild → balanced outfit selections

Style preferences are still respected regardless of weather conditions.

---

## Time of Day Context

### Description
The system categorizes time into four groups to refine outfit recommendations based on when the outfit will be worn.

| Category | Time Range |
|---|---|
| Morning | 5:00 AM – 11:59 AM |
| Work Hours | 12:00 PM – 5:59 PM |
| Evening | 6:00 PM – 9:59 PM |
| Night | 10:00 PM – 4:59 AM |

Occasion takes priority over time when specified. Time refines recommendations within the selected occasion context. Lifestyle preferences apply as an additional weighting layer.

### System Behavior
When generating recommendations:
- The current time is detected and assigned a category
- The detected category is displayed to the user (e.g., "Time: Evening")

If time data is unavailable:
- The system defaults to Work Hours or no time context
- Recommendations continue without interruption

Manual override:
- A dropdown allows selection of any time category
- A "Use auto-detect" option restores automatic behavior
- The override persists for the session or until changed

### Recommendation Integration
Time of day influences scoring, not filtering — no valid outfit options are removed.
- Morning → practical and comfortable outfits
- Work Hours → structured, appropriate outfits for public or professional settings
- Evening → more flexible, style-forward choices
- Night → comfort-focused and relaxed outfits

---

## Upcoming Weather Outfit Suggestions

### Description
Users can receive outfit recommendations based on forecast weather conditions for future days, not just the current moment. This allows users to plan what to wear in advance based on expected temperature, precipitation, and general conditions.

### System Behavior
When upcoming weather data is available:
- The system retrieves forecast data for upcoming days
- Outfit suggestions are generated for each future day using the same temperature-category logic as current-day recommendations (cold, cool, mild, warm, hot)
- Suggestions reflect the expected temperature, precipitation, and general conditions for that day

When a user views outfit suggestions for a future day:
- The outfit displayed reflects the forecast conditions for that specific date
- Temperature category and relevant weather details are shown alongside the suggestion

When forecast data is unavailable for a specific day:
- The system falls back to standard recommendation logic without weather weighting
- The user is informed that forecast data is unavailable for that day

### Recommendation Integration
Upcoming weather suggestions use the same scoring and weather-weighting logic as current-day recommendations. Forecast conditions replace real-time weather data as the context input for those days.
