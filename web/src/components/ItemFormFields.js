import React, { useState, useCallback } from "react";
import {
  LAYER_TYPE_OPTIONS,
  STYLE_TAG_OPTIONS,
  OCCASION_TAG_OPTIONS,
  SEASON_TAG_OPTIONS,
  clothingTypeOptionsForCategory,
  normalizeTagList,
  optionLabel,
} from "../utils/wardrobeOptions";
import { colorToCss } from "../utils/recommendationEngine";

const CATEGORIES = ["Tops", "Bottoms", "Outerwear", "Shoes", "Accessories"];
const COLOR_PICKER_OPTIONS = ["Black", "White", "Gray", "Beige", "Brown", "Navy", "Blue", "Green", "Olive", "Yellow", "Orange", "Red", "Pink", "Purple", "Gold", "Silver", "Burgundy", "Teal", "Cream", "Charcoal"];


function parseColors(value) {
  if (!value) return [];
  return value.split(",").map((c) => c.trim()).filter(Boolean);
}

function isValidCustomColor(raw) {
  const value = (raw || "").trim();
  if (!value) return false;
  return /^[A-Za-z][A-Za-z\s-]*$/.test(value);
}

function ColorChipInput({ value, onChange }) {
  const [selected, setSelected] = useState("");
  const colors = parseColors(value);

  const addColor = useCallback((raw) => {
    const c = raw.trim();
    if (!isValidCustomColor(c)) return;
    const existing = parseColors(value);
    if (existing.some((e) => e.toLowerCase() === c.toLowerCase())) return;
    onChange([...existing, c].join(", "));
    setSelected("");
  }, [value, onChange]);

  const removeColor = useCallback((idx) => {
    const existing = parseColors(value);
    existing.splice(idx, 1);
    onChange(existing.join(", "));
  }, [value, onChange]);

  const togglePaletteColor = useCallback((raw) => {
    const existing = parseColors(value);
    const index = existing.findIndex((entry) => entry.toLowerCase() === raw.toLowerCase());
    if (index >= 0) {
      existing.splice(index, 1);
      onChange(existing.join(", "));
      return;
    }
    onChange([...existing, raw].join(", "));
  }, [value, onChange]);

  return (
    <div className="colorChipInputWrap">
      {colors.map((c, i) => (
        <span key={i} className="colorChip">
          <span className="colorChipDot" style={{ background: colorToCss(c) }} aria-hidden="true" />
          {c}
          <button type="button" className="colorChipX" onClick={() => removeColor(i)} aria-label={`Remove ${c}`}>&times;</button>
        </span>
      ))}

      <div className="colorPaletteWrap" aria-label="Quick color picker">
        {COLOR_PICKER_OPTIONS.map((option) => {
          const active = colors.some((entry) => entry.toLowerCase() === option.toLowerCase());
          return (
            <button
              key={option}
              type="button"
              className={active ? "colorPaletteBtn active" : "colorPaletteBtn"}
              onClick={() => togglePaletteColor(option)}
              aria-pressed={active}
              title={option}
            >
              <span className="colorPaletteSwatch" style={{ background: colorToCss(option) }} aria-hidden="true" />
              <span className="colorPaletteLabel">{option}</span>
            </button>
          );
        })}
      </div>

      <div className="colorPickerRow">
        <input
          className="colorChipSelect"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addColor(selected);
            }
          }}
          placeholder="Type a color name"
          aria-label="Type a custom color"
        />
        <button
          type="button"
          className="colorPickerAddBtn"
          onClick={() => addColor(selected)}
          disabled={!isValidCustomColor(selected)}
        >
          Add
        </button>
      </div>
    </div>
  );
}

function MultiSelectChipField({ options, value, onChange }) {
  const selected = normalizeTagList(value);
  const toggle = (raw) => {
    const next = new Set(selected);
    if (next.has(raw)) next.delete(raw);
    else next.add(raw);
    onChange([...next]);
  };

  return (
    <div className="wardrobeFilterChips" style={{ marginTop: 8 }}>
      {options.map((option) => {
        const active = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            className={active ? "wardrobeFilterChip active" : "wardrobeFilterChip"}
            onClick={() => toggle(option)}
          >
            {optionLabel(option)}
          </button>
        );
      })}
    </div>
  );
}

export { ColorChipInput, MultiSelectChipField };

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
  clothingType = "", onClothingTypeChange = () => {},
  layerType = "", onLayerTypeChange = () => {},
  isOnePiece = false, onIsOnePieceChange = () => {},
  setId = "", onSetIdChange = () => {},
  styleTags = [], onStyleTagsChange = () => {},
  occasionTags = [], onOccasionTagsChange = () => {},
  seasonTags = [], onSeasonTagsChange = () => {},
  isClassifying,
  error,
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const clothingTypeOptions = clothingTypeOptionsForCategory(category);

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
        <span className="wardrobeFieldHelp">Give this piece a short name you will recognize later.</span>
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
        <span className="wardrobeFieldHelp">Choose the main outfit role this item plays.</span>
      </label>

      <label className="wardrobeLabel">
        Clothing type
        <select className="wardrobeInput" value={clothingType} onChange={(e) => onClothingTypeChange(e.target.value)}>
          <option value="">Generic {category.slice(0, -1)}</option>
          {clothingTypeOptions.map((option) => (
            <option key={option} value={option}>{optionLabel(option)}</option>
          ))}
        </select>
        <span className="wardrobeFieldHelp">Use a specific type like hoodie, blazer, tee, or jeans when it fits.</span>
      </label>

      <label className="wardrobeLabel">
        Color(s)
        <ColorChipInput value={color} onChange={onColorChange} />
        <span className="wardrobeFieldHelp">Add one or more visible colors so recommendations can coordinate better.</span>
      </label>

      <div className="wardrobeAdvancedCard">
        <button
          type="button"
          className={showAdvanced ? "wardrobeAdvancedToggle active" : "wardrobeAdvancedToggle"}
          onClick={() => setShowAdvanced((prev) => !prev)}
          aria-expanded={showAdvanced}
        >
          <span>
            {showAdvanced ? "Hide advanced details" : "Add advanced details"}
          </span>
          <span className={showAdvanced ? "wardrobeAdvancedChevron open" : "wardrobeAdvancedChevron"}>v</span>
        </button>

        <div className="wardrobeAdvancedHint">
          Optional extras for better recommendations like fit, layering, seasons, and style.
        </div>

        {showAdvanced ? (
          <div className="wardrobeAdvancedFields">
            <label className="wardrobeLabel">
              Fit (optional)
              <select className="wardrobeInput" value={fitTag} onChange={(e) => onFitTagChange(e.target.value)}>
                {FIT_TAG_OPTIONS.map((x) => (
                  <option key={x.value} value={x.value}>{x.label}</option>
                ))}
              </select>
              <span className="wardrobeFieldHelp">Fit helps the app understand whether the piece feels relaxed, fitted, or oversized.</span>
            </label>

            <label className="wardrobeLabel">
              Layer type
              <select className="wardrobeInput" value={layerType} onChange={(e) => onLayerTypeChange(e.target.value)}>
                {LAYER_TYPE_OPTIONS.map((option) => (
                  <option key={option.value || "blank"} value={option.value}>{option.label}</option>
                ))}
              </select>
              <span className="wardrobeFieldHelp">Layer type tells FitGPT whether this works as a base, mid, or outer layer.</span>
            </label>

            <label className="wardrobeLabel">
              Matching set ID (optional)
              <input
                className="wardrobeInput"
                value={setId}
                onChange={(e) => onSetIdChange(e.target.value)}
                placeholder="Example: navy-suit"
              />
              <span className="wardrobeFieldHelp">Use the same set ID on matching pieces you usually wear together.</span>
            </label>

            <label className="wardrobeLabel" style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={!!isOnePiece}
                onChange={(e) => onIsOnePieceChange(e.target.checked)}
              />
              One-piece item
            </label>
            <div className="wardrobeFieldHelp" style={{ marginTop: -4 }}>Mark dresses, jumpsuits, rompers, or overalls that replace a separate top and bottom.</div>

            <label className="wardrobeLabel">
              Style tags
              <MultiSelectChipField options={STYLE_TAG_OPTIONS} value={styleTags} onChange={onStyleTagsChange} />
              <span className="wardrobeFieldHelp">Style tags help recommendations stay casual, formal, athletic, and more.</span>
            </label>

            <label className="wardrobeLabel">
              Occasion tags
              <MultiSelectChipField options={OCCASION_TAG_OPTIONS} value={occasionTags} onChange={onOccasionTagsChange} />
              <span className="wardrobeFieldHelp">Occasion tags help FitGPT match the outfit to work, social, athletic, and similar contexts.</span>
            </label>

            <label className="wardrobeLabel">
              Season tags
              <MultiSelectChipField options={SEASON_TAG_OPTIONS} value={seasonTags} onChange={onSeasonTagsChange} />
              <span className="wardrobeFieldHelp">Season tags help the app avoid winter pieces in summer and vice versa.</span>
            </label>
          </div>
        ) : null}
      </div>

      {error ? <div className="wardrobeFormError">{error}</div> : null}
    </div>
  );
}

export default React.memo(ItemFormFields);
