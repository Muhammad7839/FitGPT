import React, { useState, useCallback } from "react";

const CATEGORIES = ["Tops", "Bottoms", "Outerwear", "Shoes", "Accessories"];

/* ── Multi-color chip input ─────────────────────────────────── */

function parseColors(value) {
  if (!value) return [];
  return value.split(",").map((c) => c.trim()).filter(Boolean);
}

function ColorChipInput({ value, onChange }) {
  const [draft, setDraft] = useState("");
  const colors = parseColors(value);

  const addColor = useCallback((raw) => {
    const c = raw.trim();
    if (!c) return;
    const existing = parseColors(value);
    if (existing.some((e) => e.toLowerCase() === c.toLowerCase())) return;
    onChange([...existing, c].join(", "));
    setDraft("");
  }, [value, onChange]);

  const removeColor = useCallback((idx) => {
    const existing = parseColors(value);
    existing.splice(idx, 1);
    onChange(existing.join(", "));
  }, [value, onChange]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addColor(draft);
    }
    if (e.key === "Backspace" && !draft && colors.length) {
      removeColor(colors.length - 1);
    }
  }, [draft, colors, addColor, removeColor]);

  return (
    <div className="colorChipInputWrap" onClick={(e) => e.currentTarget.querySelector("input")?.focus()}>
      {colors.map((c, i) => (
        <span key={i} className="colorChip">
          {c}
          <button type="button" className="colorChipX" onClick={() => removeColor(i)} aria-label={`Remove ${c}`}>&times;</button>
        </span>
      ))}
      <input
        className="colorChipDraft"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => addColor(draft)}
        placeholder={colors.length ? "" : "Type a color and press Enter"}
      />
    </div>
  );
}

export { ColorChipInput };

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
        Color(s)
        <ColorChipInput value={color} onChange={onColorChange} />
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
