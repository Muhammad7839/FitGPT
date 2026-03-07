import React from "react";

const CATEGORIES = ["Tops", "Bottoms", "Outerwear", "Shoes", "Accessories"];

const FIT_TAG_OPTIONS = [
  { value: "unknown", label: "Unknown" },
  { value: "slim", label: "Slim" },
  { value: "regular", label: "Regular" },
  { value: "relaxed", label: "Relaxed" },
  { value: "oversized", label: "Oversized" },
  { value: "tailored", label: "Tailored" },
  { value: "athletic", label: "Athletic" },
  { value: "petite", label: "Petite" },
  { value: "plus", label: "Plus" },
];

export { CATEGORIES, FIT_TAG_OPTIONS };

function ItemFormFields({
  name, onNameChange,
  category, onCategoryChange,
  color, onColorChange,
  fitTag, onFitTagChange,
  isClassifying,
  error,
}) {
  return (
    <div className="wardrobeAddForm">
      <label className="wardrobeLabel">
        Item name
        <input
          className="wardrobeInput"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Example: White tee"
        />
      </label>

      <label className="wardrobeLabel">
        Category
        <div style={{ position: "relative" }}>
          <select className="wardrobeInput" value={category} onChange={(e) => onCategoryChange(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {isClassifying && <span className="classifyingHint">Detecting...</span>}
        </div>
      </label>

      <label className="wardrobeLabel">
        Color
        <input
          className="wardrobeInput"
          value={color}
          onChange={(e) => onColorChange(e.target.value)}
          placeholder="Example: Black"
        />
      </label>

      <label className="wardrobeLabel">
        Fit (optional)
        <select className="wardrobeInput" value={fitTag} onChange={(e) => onFitTagChange(e.target.value)}>
          {FIT_TAG_OPTIONS.map((x) => (
            <option key={x.value} value={x.value}>{x.label}</option>
          ))}
        </select>
      </label>

      {error ? <div className="wardrobeFormError">{error}</div> : null}
    </div>
  );
}

export default React.memo(ItemFormFields);
