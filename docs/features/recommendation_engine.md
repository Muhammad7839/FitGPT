# Recommendation Engine

## Overview
The recommendation engine generates outfit suggestions based on the user's wardrobe, preferences, and contextual information. Clothing combinations are evaluated using a scoring system that considers color coordination, body type compatibility, weather, time of day, and outfit history.

The engine produces multiple outfit combinations and ranks them by overall score.

---

## Color Coordination

### Description
Clothing items can be assigned one or more colors. The recommendation engine uses this data to evaluate visual compatibility between items and prioritize outfits that follow basic color coordination principles such as neutral balance, contrast, and tonal combinations.

### System Behavior
When generating recommendations:
- Color data is retrieved for each wardrobe item
- Items with multiple colors have all associated colors evaluated
- Multiple outfit combinations are generated
- Combinations that follow color coordination principles receive higher scores

Outfits with clashing or incompatible color combinations receive lower scores.

Color coordination principles applied:
- **Neutral balance** — outfits grounded with neutral tones (black, white, grey, beige)
- **Contrast** — pairing light and dark items for visual distinction
- **Tonal** — items in the same color family for cohesive looks

### Recommendation Output
- Multiple outfit options are presented ranked by color compatibility
- Users can refresh to generate alternative combinations

---

## Recommendation Explanations

### Description
Each recommendation includes a clear, automatically generated explanation describing why the outfit was selected. Explanations help users understand the reasoning behind suggestions and build confidence in the system. Every outfit in a recommendation set has its own distinct explanation.

Explanations reference whichever of the following factors are relevant to that outfit:
- Color coordination between items
- Style compatibility and occasion appropriateness
- Seasonal fit
- Weather suitability
- Comfort attributes (warmth, layering, breathability, fit type)
- Body type compatibility
- Overall outfit structure and balance

If some metadata is missing for a given item or context, the system still produces a general explanation based on whatever factors are available. Explanations are always present — no recommendation is shown without one.

### Color Reasoning
Color coordination is included in the explanation when it influenced the recommendation. Explanations describe the specific color relationship in plain language.

Examples:
- Neutral anchoring: "The white shirt keeps this outfit grounded while allowing the other pieces to stand out."
- Contrast: "The dark jeans and light top create a clean contrast that works well together."
- Tonal: "These items share similar warm tones, giving the outfit a cohesive feel."

### Comfort Reasoning
Comfort factors are included in the explanation when they influenced the recommendation. Explanations reference relevant clothing attributes such as warmth level, layering, breathability, or fit type.

Examples:
- Weather-driven: "Given the cool temperature today, this outfit adds a mid layer to keep you warm without overheating."
- Fit-driven: "These relaxed-fit pieces align with your comfort preference for looser clothing."
- General fallback (when comfort metadata is limited): "This outfit is structured to keep you comfortable throughout the day."

When environmental context such as weather is available, the explanation connects it to specific clothing choices in the outfit.

### Current Limitations
Explanations are generated using predefined templates and may sound repetitive. Future improvements will focus on more varied and contextually aware explanation text.

---

## Refresh Recommendations

### Description
Users can generate new outfit suggestions without changing their preferences or context. Refresh produces different clothing combinations while keeping all other inputs the same.

Outfit uniqueness is determined by the set of item IDs, not item order.

### System Behavior
When a user refreshes:
- A new outfit is generated using the same context and preferences
- The last 5 generated outfits in the session are tracked
- The system avoids repeating any combination within this window

If the wardrobe is limited:
- The system attempts up to 10 times to find a new combination
- If no completely new outfit is found, near alternatives are allowed (at least one major item such as a top or bottom should differ)
- If variation is not possible, the best available outfit is returned with a message: "Limited wardrobe options, showing closest alternative"

### Recommendation Integration
- Exact outfit repeats within the session window are avoided
- Near duplicates are allowed only after multiple failed attempts
- Valid recommendations are always returned, even with small wardrobes

---

## Avoiding Recent Outfits

### Description
The system avoids recommending recently worn outfits to keep suggestions fresh. This relies on outfit history as the sole source of truth for what the user has worn.

"Recent" is defined as the last 10 worn outfits, with an optional time-based rule for outfits worn within the last 7 days.

### System Behavior
When generating recommendations:
- The user's most recent outfit history is retrieved
- New combinations are evaluated against the recent list

Repeat definitions:
- **Exact repeat** — same user + same set of clothing item IDs (order does not matter)
- **Near repeat** — outfit shares 3 or more items with a recent outfit

If an outfit is an exact repeat → it is excluded from recommendations.
If an outfit is a near repeat → its recommendation score is reduced.

### Recommendation Integration
- Exact matches are removed before final results are returned
- Near matches are deprioritized through a scoring penalty
- New or less frequently worn combinations are prioritized
- Users with smaller wardrobes still receive valid outfit suggestions
- Saved outfits are not considered for repeat avoidance unless they have been marked as worn

---

## Layered Outfit Support

### Description
The recommendation engine supports layered clothing logic to generate outfits that reflect realistic combinations, particularly in cooler weather. Rather than randomly combining tops and outerwear, the system follows a logical layer order based on layer metadata stored on each clothing item.

Layer order:
1. Base layer (e.g., t-shirt, tank top)
2. Mid layer (e.g., sweater, hoodie)
3. Outerwear (e.g., coat, jacket)

### System Behavior
When generating outfit recommendations:
- The system reads layer metadata from clothing items in the wardrobe
- Outfits are built following the defined layer order where applicable
- Incompatible layer combinations are avoided (e.g., two outerwear items in the same outfit)

If the wardrobe contains limited layer items:
- The system produces the most logical outfit possible with the available items
- Missing layers are omitted rather than filled with incompatible items
- A valid recommendation is always returned

Items without a layer tag are treated as unspecified and remain eligible for inclusion without layer-order constraints.

---

## Accessory Limits

### Description
The recommendation engine limits the number of accessories included in any outfit suggestion to keep outfits visually balanced and realistic. Accessories are optional additions that complement an outfit rather than a required component.

### System Behavior
When generating outfit recommendations:
- Accessories are optional — an outfit is valid without any accessories
- When accessories are included, the number per outfit is capped to avoid cluttered combinations
- Accessories are selected to complement the rest of the outfit rather than selected arbitrarily

When multiple outfit options are generated:
- Accessories vary between suggestions where the wardrobe allows
- The same accessory is not repeated across every generated outfit in a set

### Recommendation Integration
Accessory inclusion is governed by availability and fit — the engine will not force accessories into an outfit when none complement it well. The cap on accessories ensures no single outfit is overloaded with items from the accessories category.

---

## Occasion-Based Recommendations

### Description
The recommendation engine uses occasion context to prioritize clothing items that are appropriate for the user's intended situation. Occasion takes priority over time of day when both are present.

Supported occasions:
- Casual
- Work / business casual
- Formal
- Athletic
- Social

### System Behavior
When a user selects an occasion before generating recommendations:
- The engine filters and prioritizes items whose occasion tags match the selected context
- Items without an occasion tag are treated as occasion-neutral and remain eligible
- Items with clearly conflicting occasion tags are deprioritized

If no occasion is selected:
- Default recommendation logic is used with no occasion weighting applied

If the wardrobe has limited items tagged for the selected occasion:
- The engine still produces the best available outfit using all eligible items
- A valid recommendation is always returned

### Recommendation Integration
Occasion is the highest-priority context factor — it overrides time-of-day weighting when specified. Style tags and clothing type metadata work alongside occasion tags to refine which items are selected.

---

## Multiple Outfit Options

### Description
The recommendation engine generates multiple distinct outfit combinations at once rather than a single result. This allows users to pick the option that best fits their mood, occasion, or preference without needing to refresh to see alternatives.

### System Behavior
When recommendations are generated:
- Multiple outfit options are produced and displayed simultaneously
- Each outfit follows the correct outfit structure (see [Logical Outfit Structure](#logical-outfit-structure))
- Outfits are ordered by recommendation score (see [Outfit Scoring](#outfit-scoring))

When a user refreshes recommendations:
- A new set of outfit combinations is generated using the same context and preferences
- Previously shown combinations are avoided where possible (see [Refresh Recommendations](#refresh-recommendations))

If the wardrobe has limited items:
- The system generates as many valid combinations as the wardrobe allows
- At least one outfit is always returned

---

## Logical Outfit Structure

### Description
The recommendation engine enforces structural rules to ensure generated outfits are realistic and wearable. Outfits must follow a valid composition and avoid combinations that would not normally be worn together.

### Valid Outfit Structure
A complete outfit follows this structure:
- **Top** — required (unless a one-piece item fills both top and bottom slots)
- **Bottom** — required (unless filled by a one-piece item)
- **Shoes** — required
- **Outerwear** — optional
- **Accessories** — optional, limited in quantity

### System Behavior
When generating an outfit:
- The engine selects items to fill required slots first (top, bottom, shoes)
- Optional slots (outerwear, accessories) are filled where appropriate items exist
- One-piece items fill both the top and bottom slot simultaneously — no separate top or bottom is added
- The engine enforces a one-item-per-role rule: no outfit includes two tops, two bottoms, or two pairs of shoes

Conflicting combinations are avoided:
- Items that serve the same structural role are not combined in the same outfit
- Items with heavily conflicting styles or occasions are deprioritized from appearing together

If the wardrobe has limited items:
- The engine produces the most complete outfit possible with available items
- Required slots take priority over optional slots
- A valid recommendation is always returned

---

## Outfit Scoring

### Description
Each generated outfit receives a score based on how well it satisfies a set of evaluation factors. Outfits are ranked by score so the most relevant combinations appear first.

### Scoring Factors
Outfit scores are calculated by combining weighted contributions from:
- **Color coordination** — how well the item colors work together
- **Style compatibility** — whether item style tags are consistent with each other and the selected occasion
- **Seasonal appropriateness** — how well items match the current or selected season
- **Weather suitability** — how well items suit the detected or selected temperature category
- **Fit compatibility** — how well item fit tags align with the user's body type preference
- **Recency penalty** — score reduction for outfits that closely match recently worn combinations

### System Behavior
When multiple outfits are generated:
- Each outfit is evaluated against all applicable scoring factors
- Factor contributions are combined into a total score for each outfit
- Outfits are ordered from highest to lowest score before being displayed

If wardrobe data is incomplete (e.g., missing color tags, no season tags):
- Available factors are still evaluated
- Missing data is treated as neutral — no boost or penalty is applied for that factor
- Outfits are still ranked based on whichever factors have data
