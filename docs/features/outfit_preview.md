# Outfit Preview & Builder

## Overview
FitGPT provides two ways for users to visualize and construct outfits beyond automated recommendations. The 3D mannequin preview lets users see how a selected outfit looks as a complete look. The drag-and-drop outfit builder lets users manually assemble their own combinations from their wardrobe.

---

## 3D Mannequin Preview

### Description
Users can preview outfit combinations displayed on a 3D mannequin to visualize how clothing items look together before wearing them. This gives users a spatial, layered view of the outfit rather than a flat item list.

### System Behavior
When a user selects an outfit and opens the preview feature:
- The outfit is loaded and displayed on a 3D mannequin
- Clothing items are rendered correctly layered and positioned on the mannequin (e.g., a jacket over a shirt, shoes at the feet)
- The mannequin view is interactive — the user can see the outfit as a complete look

When items are applied to the mannequin:
- Each item is positioned according to its clothing category and layer type
- Items do not overlap incorrectly — layering order follows the defined structure (base → mid → outerwear)

---

## Drag-and-Drop Outfit Builder

### Description
Users can manually build outfit combinations by dragging clothing items from their wardrobe into an outfit builder area. This allows experimentation and customization beyond what the recommendation engine produces automatically.

### System Behavior
When a user views their wardrobe and drags a clothing item:
- The item can be dropped into the outfit builder area
- Dropped items appear correctly layered and positioned within the builder

When items are added or removed from the builder:
- The outfit updates in real time without requiring a page reload or confirmation step
- The user can see the current outfit composition at any point during editing

Built outfits can be saved using the standard saved outfits flow once the user is satisfied with the combination.
