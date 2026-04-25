# Wardrobe Management

## Overview
The wardrobe system allows users to upload, organize, and manage clothing items. Each item includes metadata (category, color, fit, style tags) used by the recommendation engine to generate accurate outfit suggestions.

---

## Clothing Categories

### Description
Each clothing item is assigned to a category. Categories organize the wardrobe and help the recommendation engine build structured outfit combinations.

Supported categories:
- Tops
- Bottoms
- Shoes
- Accessories
- Outerwear

### Recommendation Integration
Categories ensure outfit recommendations follow a logical structure (e.g., one top, one bottom, one pair of shoes, optional outerwear or accessories). This prevents unrealistic combinations such as selecting multiple items from the same category.

---

## Uploading Clothing Items

### System Behavior
When a user uploads a clothing item:
- Required information is validated
- The item is stored in the user's wardrobe
- The new item appears in the wardrobe list

If an upload fails, a clear error message is shown.

### Recommendation Integration
Uploaded items are immediately available to the recommendation engine. Adding more items improves recommendation accuracy and variety.

---

## Bulk Upload

### Description
Users can upload multiple clothing images at once instead of adding them individually. Each image is treated as a separate wardrobe item.

Supported methods:
- Multi-file selection via file picker
- Drag and drop (if supported)

After upload, users can review and edit item details (type, category, color, style tags, season tags). Missing metadata does not block uploads but improves recommendation quality when completed.

### System Behavior
When a bulk upload is performed:
- Each file is processed independently
- Each successful upload creates a new wardrobe item
- Upload progress and completion are indicated to the user

If some uploads fail:
- Successful items are still added to the wardrobe
- Failed items show an error message
- The overall process continues without interruption

Example: 5 files uploaded → 4 succeed (added to wardrobe), 1 fails (shows error, not added).

---

## Editing Clothing Items

### System Behavior
When a user edits a clothing item:
- The item's stored information can be modified
- Updated details are saved on confirmation
- The wardrobe view refreshes to show the updated item

If the user cancels before saving, the original data remains unchanged.

### Recommendation Integration
Updated metadata is used immediately by the recommendation engine in future outfit generation.

---

## Deleting Clothing Items

### System Behavior
When a user selects delete on a clothing item:
- A confirmation prompt is shown
- If confirmed, the item is permanently removed from the wardrobe
- If cancelled, the item remains unchanged

Deleted items are no longer available in the wardrobe or recommendations.

### Recommendation Integration
Only active wardrobe items are used during recommendation generation. Deleted items are fully excluded.

---

## Archived Items

### Description
Archiving hides a clothing item from the active wardrobe without permanently deleting it. Archived items remain stored and can be restored at any time. This is a reversible alternative to deletion.

Item states:
- **Active** — visible in wardrobe, included in recommendations
- **Archived** — hidden from wardrobe, excluded from recommendations

### System Behavior
When a user archives an item:
- The item remains in the database
- It is removed from the active wardrobe view
- It is excluded from recommendations and planning

Archived items are accessible through a dedicated Archived view, where each item has an "Unarchive" option. Archived items remain editable.

If a saved outfit contains an archived item:
- The outfit may still appear in the saved list
- A warning ("Contains archived item") is shown
- Planning or using that outfit may be restricted until the item is unarchived

### Recommendation Integration
Archived items are fully excluded from recommendations, planner outfit selection, and saved outfit generation.

---

## Color Tagging

### Description
Users can assign one or more colors to a clothing item using a color picker when uploading or editing wardrobe items. Multiple colors can be assigned to accurately represent patterned or multicolored clothing. Color data is used by the recommendation engine to generate visually coordinated outfits.

### System Behavior
When a user uploads or edits an item:
- They can select one or more colors using the color picker
- All selected colors are saved with the item
- Selected colors are visible in the item details when viewing the wardrobe

### Recommendation Integration
See [Color Coordination](recommendation_engine.md#color-coordination) in the recommendation engine docs. When an item has multiple colors, the engine evaluates all associated colors when determining outfit compatibility.

---

## Fit Tagging

### Description
Fit tags describe how a garment sits on the body. They are used to generate personalized, body-type-aware recommendations. Fit selection is optional — if not selected, the system assigns `unknown` by default.

### Fit Tag Options
- slim
- regular
- relaxed
- oversized
- tailored
- athletic
- petite
- plus
- unknown *(default)*

### System Behavior
When a user uploads or edits an item:
- They can select a fit tag from the predefined list
- If no fit is selected, `unknown` is assigned automatically
- The fit tag is stored with the item

During outfit generation:
- The user's body type preference is evaluated
- Items with compatible fit tags are prioritized
- Items with `unknown` fit are treated as neutral and remain eligible

### Body Type Compatibility Logic
| User Preference | Prioritized Fits |
|---|---|
| Fitted | slim, tailored |
| Comfort-based | relaxed, oversized |
| Neutral | regular |
| Unknown | no boost or penalty |

### Recommendation Integration
Fit tags influence scoring only — they do not act as strict filters. The system always returns recommendations even when fit data is incomplete or does not strongly match user preferences.

---

## Saved Outfits

### Description
Users can save outfit combinations for future reuse. Saved outfits are persistent, tied to the user's account, and accessible across sessions. Users can optionally rename outfits or add notes.

The system prevents duplicate saved outfits by normalizing (sorting) item IDs before comparison.

### System Behavior
When a user saves an outfit:
- Item IDs are collected and normalized
- The system checks if the same outfit already exists for that user
- If new → a saved outfit record is created
- If duplicate → no record is created and the user is notified

Saved outfits persist after logout and login.

### Recommendation Integration
Saved outfits do not require the recommendation engine when reused — the system directly loads the stored item IDs. Saved outfits can also be scheduled via the planner.

---

## Outfit History

### Description
Outfit history tracks outfits that a user has explicitly confirmed as worn. History is the source of truth for recently worn outfits and is used by the recommendation engine to improve variety.

A "worn" outfit can be recorded when:
- A user selects "Wear Today" or marks a recommended outfit as worn
- A user marks a planned outfit as worn

### System Behavior
- Outfits are only added to history when explicitly confirmed — viewing or generating an outfit does not record it
- Each entry stores: item IDs, timestamp, and outfit source
- History is displayed newest-first

Users can filter history by:
- Last 7 days
- Last 30 days
- All history

If no history exists, an empty state message is displayed.

### Recommendation Integration
Outfit history is used to avoid recommending recently worn outfits. A configurable window (e.g., last 10 outfits or last 7 days) defines what counts as "recent."

- Recently worn outfits are deprioritized or excluded
- Older or unused combinations are prioritized
- Saved outfits are not used for repeat avoidance unless they have been marked as worn

---

## Favorites

### Description
Users can mark outfits as favorites to quickly access and reuse combinations they like. Favorited outfits are stored persistently and displayed in a dedicated Favorites section, separate from the general saved outfits list.

### System Behavior
When a user marks an outfit as a favorite:
- The outfit is added to the favorites list
- It remains accessible in the Favorites section across sessions

When a user opens the Favorites section:
- All favorited outfits are displayed
- Each favorited outfit is available for reuse in planning or as a recommendation starting point

Favorited outfits persist after logout and login.

### Recommendation Integration
Favorited outfits are available for direct reuse when planning outfits or browsing recommendations. They do not require the recommendation engine to be re-run — the stored item IDs are loaded directly.

---

## Wardrobe Search

### Description
Users can search their wardrobe by entering a query to quickly locate specific clothing items without scrolling through the full list. Search matches against item name, category, color, and clothing type.

### System Behavior
When a user enters a search term:
- The wardrobe list filters to show only items matching the query
- Matching is applied across name, category, color, and clothing type

If no items match the search query:
- A clear message is displayed indicating no results were found
- No items are shown in the list

When the search field is cleared:
- The full wardrobe list is restored

---

## Wardrobe Filters

### Description
Users can apply filters to narrow down wardrobe items by category, color, style, season, or clothing type. Filters help locate specific items quickly without scrolling.

### System Behavior
When a user selects a filter option:
- Only items matching that filter are displayed

When multiple filters are active:
- Only items matching all active filters are shown (AND logic)

When all filters are cleared:
- The full wardrobe list is restored

Filters and search can be used together — active filters apply on top of any search query.

---

## Layer Tagging

### Description
Users can assign a layer type to clothing items to indicate where the item sits in a layered outfit. This metadata is used by the recommendation engine to build outfits that follow a logical layering structure, especially in cooler weather.

Layer types:
- **Base layer** — worn directly against the skin (e.g., t-shirt, tank top)
- **Mid layer** — worn over the base layer for warmth (e.g., sweater, hoodie, fleece)
- **Outerwear** — outermost layer worn over all others (e.g., coat, jacket)

Layer selection is optional. Items without a layer tag are treated as unspecified and remain eligible for recommendations.

### System Behavior
When a user uploads or edits a clothing item:
- They can optionally select a layer type from the predefined list
- The selected layer type is stored with the item

### Recommendation Integration
See [Layered Outfit Support](recommendation_engine.md#layered-outfit-support) in the recommendation engine docs.

---

## One-Piece Items & Clothing Sets

### Description
Some clothing items function as both a top and a bottom (e.g., dresses, jumpsuits, overalls). Others belong to a matching set where items are designed to be worn together (e.g., suits, tracksuits, co-ord sets).

Users can mark items accordingly so the recommendation engine handles them correctly.

Item classifications:
- **One-piece** — acts as both top and bottom; no separate top or bottom should be paired with it
- **Set item** — belongs to a named group of matching items that should be recommended together

### System Behavior
When a user marks an item as a one-piece:
- The item is stored with a one-piece flag
- The recommendation engine treats it as filling both the top and bottom slots in an outfit

When a user marks items as part of a set:
- A set relationship is stored between the linked items
- Each item in the set references the same set identifier

### Recommendation Integration
When generating outfit recommendations:
- One-piece items fill the top and bottom slots simultaneously — no separate top or bottom is added
- Set items are prioritized to be recommended together when one set member is selected
- Outfits are still generated logically if only some set items are available or if the wardrobe has limited options

---

## Style Tagging

### Description
Users can assign a style tag to clothing items when uploading or editing wardrobe items. Style tags describe the intended context or mood of the clothing piece (e.g., formal, casual, activewear, relaxed). These tags help the recommendation engine match outfit suggestions to the user's occasion or context.

Supported style tags include:
- Formal
- Business casual
- Casual
- Relaxed
- Activewear / athletic
- Streetwear

Style tag selection is optional. Items without a style tag are treated as style-neutral and remain eligible for any recommendation context.

### System Behavior
When a user uploads or edits a clothing item:
- They can select a style tag from the predefined list
- The selected tag is saved with the item
- The style tag is visible when viewing the item in the wardrobe

### Recommendation Integration
When generating outfit recommendations for a specific occasion or context:
- Items whose style tags match the target context are prioritized
- Items without a style tag are treated as neutral and may still appear in recommendations
- The system avoids building outfits that mix heavily conflicting styles (e.g., formal with activewear)

---

## Clothing Type

### Description
Users can assign a detailed clothing type to items when uploading or editing wardrobe items. Clothing type is a sub-classification within a category that gives the recommendation engine more specific information about how a piece should be used in an outfit.

Example clothing types by category:
- **Tops** — t-shirt, shirt, blouse, sweater, hoodie, tank top, polo
- **Bottoms** — jeans, trousers, shorts, skirt, leggings, joggers
- **Outerwear** — coat, jacket, blazer, puffer, windbreaker
- **Shoes** — sneakers, boots, loafers, heels, sandals
- **Accessories** — hat, scarf, belt, bag, sunglasses

### System Behavior
When a user uploads or edits a clothing item:
- They can select a clothing type from the predefined list for that category
- The selected type is saved as metadata with the item
- The clothing type is visible when viewing the item in the wardrobe

If no clothing type is selected:
- The item remains eligible for recommendations using default category logic

### Recommendation Integration
Clothing type metadata allows the engine to build more appropriate outfit combinations. For example, a hoodie and a blazer are both tops but suit different contexts — clothing type lets the engine distinguish between them when context or occasion is specified.

If clothing type is missing, the system falls back to category-level logic and still produces valid recommendations.

---

## Season Tagging

### Description
Users can assign a season tag to clothing items to indicate when an item is typically worn. Season tags allow the recommendation engine to prioritize items appropriate for the current or selected season and avoid suggesting items that belong to a different season.

Supported season tags:
- Spring
- Summer
- Autumn / Fall
- Winter
- All-season

### System Behavior
When a user uploads or edits a clothing item:
- They can select one or more season tags from the predefined list
- The selected season tags are saved with the item

### Recommendation Integration
When generating outfit recommendations:
- Items tagged for the current season are prioritized
- Items tagged for a conflicting season are deprioritized or avoided
- Items without a season tag are treated as all-season and remain fully eligible
- If the wardrobe has limited seasonal items, the system still generates the most logical outfit possible using available items

---

## Occasion Tagging

### Description
Users can assign occasion tags to clothing items to indicate the context in which an item is typically worn. Occasion tags allow the recommendation engine to build outfits appropriate for the user's intended situation.

Supported occasion tags:
- Casual
- Work / business casual
- Formal
- Athletic
- Social

Occasion tag selection is optional. Items without an occasion tag are treated as occasion-neutral and remain eligible for any recommendation context.

### System Behavior
When a user uploads or edits a clothing item:
- They can select one or more occasion tags from the predefined list
- The selected tags are saved with the item

### Recommendation Integration
See [Occasion-Based Recommendations](recommendation_engine.md#occasion-based-recommendations) in the recommendation engine docs. When an occasion is selected by the user, items with matching occasion tags are prioritized. Items with conflicting tags are deprioritized. Items with no tag remain eligible.

---

## Automatic Tag Suggestions

### Description
When a user uploads or adds a clothing item, the system automatically generates suggested tags for that item. This reduces the manual effort required to organize the wardrobe by pre-filling metadata such as color, style, clothing type, season, and occasion.

Suggested tags are not applied automatically — the user reviews them and can accept, modify, or remove any suggestion before saving.

### System Behavior
When a clothing item is uploaded or added:
- The system analyzes the item and generates suggested tags
- Suggested tags are displayed for user review before the item is saved
- Supported tag types for suggestions: color, style, clothing type, season, occasion

When the user reviews suggested tags:
- Tags can be accepted as-is, edited, or removed
- Additional tags can be added manually alongside the suggestions

When the item is saved:
- Only the accepted and edited tags are stored with the item
- Stored tags are used for wardrobe organization and recommendation scoring

---

## Wardrobe Gap Detection

### Description
The system can analyze a user's wardrobe and identify missing or underrepresented clothing items. This helps users understand what their wardrobe lacks and provides guidance on what to add to improve outfit variety and completeness.

Gap detection considers the user's existing categories, styles, and seasons to determine where the wardrobe is thin.

### System Behavior
When gap detection is run:
- The system analyzes the user's wardrobe by category, style, season, and occasion coverage
- Missing or underrepresented item types are identified
- Results are displayed with suggested items including images and shopping links

When results are displayed:
- Each gap is shown with a description of what is missing and why it would improve the wardrobe
- Suggested items include visual examples

When a user interacts with a suggestion:
- They can navigate to an external source to purchase or explore the suggested item

---

## Underused Clothing Alerts

### Description
The system tracks clothing usage through outfit history and identifies items that have not been worn for an extended period. Users are alerted about underused items to encourage better wardrobe rotation and make fuller use of their owned clothing.

### System Behavior
When the system analyzes clothing usage:
- Items that have not appeared in outfit history within a defined period are flagged as underused
- The user is notified with a list of underused items and a prompt to incorporate them

When a user views an underused clothing alert:
- They receive outfit suggestions that incorporate the flagged item
- The suggestions are generated using the recommendation engine with the underused item as a required component

---

## Outfit Reuse Tracking

### Description
The system tracks how often individual clothing items are worn, based on outfit history records. This data helps users plan laundry cycles and avoid overusing or under-washing specific items.

This feature extends outfit history by surfacing per-item usage counts rather than just outfit-level records.

### System Behavior
When a user logs or confirms an outfit as worn:
- Usage data for each clothing item in the outfit is updated
- Wear count and last-worn date are recorded per item

When a clothing item reaches a configurable reuse threshold:
- The system notifies the user that the item may need washing before being worn again

When a user views laundry-related insights:
- They can see wear counts for each item
- Items that are frequently reused or overdue for washing are highlighted

---

## Calendar View

### Description
Users can view their outfit history in a calendar layout, showing what was worn on each day. This provides a visual overview of wardrobe usage over time and allows users to browse past outfits by date.

### System Behavior
When a user opens the calendar view:
- Outfit history entries are mapped to their corresponding calendar dates
- Days on which an outfit was logged appear with a visual indicator or outfit preview

When a user selects a specific date:
- The details of the outfit worn on that day are shown, including the clothing items included

When a user navigates between dates or months:
- The calendar updates to display the correct outfit history for the selected period
- Days with no outfit logged show as empty

---

## Seasonal Wardrobe Rotation

### Description
The system can filter the active wardrobe based on the current season, ensuring that only seasonally appropriate items are surfaced in recommendations and wardrobe browsing. This keeps the wardrobe view and recommendation results relevant without requiring users to manually archive off-season items.

### System Behavior
When seasonal mode is active:
- The system detects the current season
- Only items tagged for the current season (or tagged as all-season) are prioritized in recommendations
- The wardrobe view surfaces season-appropriate items prominently

Out-of-season items:
- Are deprioritized in recommendations but not permanently excluded
- Remain visible in the wardrobe if the user browses outside of seasonal mode

When seasonal mode is off:
- All wardrobe items are treated equally regardless of season tags

### Recommendation Integration
Seasonal filtering applies on top of standard recommendation scoring. Out-of-season items receive a score penalty. All-season items and items with no season tag are not penalized.

---

## Duplicate Clothing Detection

### Description
The system can analyze a user's wardrobe and identify clothing items that are duplicates or highly similar to other items already saved. This helps users maintain an organized wardrobe and reduce clutter from redundant entries.

### System Behavior
When a user adds or uploads a clothing item:
- The system analyzes it against existing wardrobe items
- Items that are identified as potential duplicates or highly similar are flagged

When duplicates are detected:
- The user is notified and shown the similar items side by side
- The notification does not block the item from being saved

When a user reviews flagged duplicates:
- They can choose to keep both items, merge them into one, or delete one
- The action is applied immediately and the wardrobe updates accordingly
