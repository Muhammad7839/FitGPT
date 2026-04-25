import React, { useCallback, useEffect, useState } from "react";
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
import SuggestedTagsPanel from "./SuggestedTagsPanel";

const CATEGORIES = ["Tops", "Bottoms", "Outerwear", "Shoes", "Accessories", "One-Piece"];
const COLOR_PICKER_OPTIONS = [
  "Black", "White", "Gray", "Light Gray", "Charcoal", "Silver",
  "Beige", "Cream", "Ivory", "Tan", "Khaki",
  "Brown", "Light Brown", "Dark Brown", "Chocolate", "Caramel",
  "Navy", "Blue", "Light Blue", "Sky Blue", "Teal",
  "Green", "Olive", "Forest Green", "Mint", "Lime",
  "Red", "Burgundy", "Maroon", "Wine",
  "Pink", "Hot Pink", "Rose", "Coral",
  "Purple", "Lavender",
  "Yellow", "Gold", "Orange",
];

function parseColors(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function isValidCustomColor(raw) {
  const value = (raw || "").trim();
  if (!value) return false;
  return /^[A-Za-z][A-Za-z\s-]*$/.test(value);
}

function summarizeSelection(values, placeholder) {
  if (!values.length) return placeholder;
  const labels = values.map(optionLabel);
  if (labels.length <= 2) return labels.join(", ");
  return `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
}

function CompactMultiSelectField({
  options,
  value,
  onChange,
  placeholder = "Choose options",
  helperLabel = "Open picker",
}) {
  const selected = normalizeTagList(value);

  const toggle = (raw) => {
    const next = new Set(selected);
    if (next.has(raw)) next.delete(raw);
    else next.add(raw);
    onChange([...next]);
  };

  return (
    <details className="pickerField">
      <summary className="pickerFieldTrigger">
        <div className="pickerFieldTriggerText">
          <span className={selected.length ? "pickerFieldValue" : "pickerFieldPlaceholder"}>
            {summarizeSelection(selected, placeholder)}
          </span>
          <span className="pickerFieldMeta">
            {selected.length ? `${selected.length} selected` : helperLabel}
          </span>
        </div>
        <span className="pickerFieldChevron" aria-hidden="true">v</span>
      </summary>

      <div className="pickerFieldMenu">
        {options.map((option) => {
          const active = selected.includes(option);
          return (
            <label
              key={option}
              className={active ? "pickerOption active" : "pickerOption"}
            >
              <input
                className="pickerCheckbox"
                type="checkbox"
                checked={active}
                onChange={() => toggle(option)}
              />
              <span className="pickerOptionLabel">{optionLabel(option)}</span>
            </label>
          );
        })}
      </div>
    </details>
  );
}

function ColorPickerField({ value, onChange }) {
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const colors = parseColors(value);

  const addColor = useCallback((raw) => {
    const color = raw.trim();
    if (!isValidCustomColor(color)) return;
    const existing = parseColors(value);
    if (existing.some((entry) => entry.toLowerCase() === color.toLowerCase())) return;
    onChange([...existing, color].join(", "));
    setDraft("");
  }, [onChange, value]);

  const removeColor = useCallback((raw) => {
    const next = parseColors(value).filter((entry) => entry.toLowerCase() !== raw.toLowerCase());
    onChange(next.join(", "));
  }, [onChange, value]);

  const togglePaletteColor = useCallback((raw) => {
    const existing = parseColors(value);
    const index = existing.findIndex((entry) => entry.toLowerCase() === raw.toLowerCase());
    if (index >= 0) {
      existing.splice(index, 1);
      onChange(existing.join(", "));
      return;
    }
    onChange([...existing, raw].join(", "));
  }, [onChange, value]);

  return (
    <details className="pickerField">
      <summary className="pickerFieldTrigger">
        <div className="pickerFieldTriggerText pickerFieldTriggerTextColors">
          <div className="pickerSwatchPreview" aria-hidden="true">
            {colors.length ? (
              colors.slice(0, 3).map((color) => (
                <span
                  key={color}
                  className="pickerSwatch"
                  style={{ background: colorToCss(color) }}
                />
              ))
            ) : (
              <span className="pickerSwatch pickerSwatchEmpty" />
            )}
          </div>
          <div className="pickerFieldColorCopy">
            <span className={colors.length ? "pickerFieldValue" : "pickerFieldPlaceholder"}>
              {summarizeSelection(colors, "Choose color(s)")}
            </span>
            <span className="pickerFieldMeta">
              {colors.length ? `${colors.length} selected` : "Open color picker"}
            </span>
          </div>
        </div>
        <span className="pickerFieldChevron" aria-hidden="true">v</span>
      </summary>

      <div className="pickerFieldMenu">
        <input
          className="wardrobeInput colorPickerSearch"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search colors..."
          aria-label="Search colors"
        />
        <div className="colorPickerGrid" aria-label="Color picker">
          {COLOR_PICKER_OPTIONS.filter((option) =>
            !search || option.toLowerCase().includes(search.toLowerCase())
          ).map((option) => {
            const active = colors.some((entry) => entry.toLowerCase() === option.toLowerCase());
            return (
              <button
                key={option}
                type="button"
                className={active ? "colorPickerBtn active" : "colorPickerBtn"}
                onClick={() => togglePaletteColor(option)}
                aria-pressed={active}
              >
                <span
                  className="colorPickerBtnSwatch"
                  style={{ background: colorToCss(option) }}
                  aria-hidden="true"
                />
                <span className="colorPickerBtnLabel">{option}</span>
              </button>
            );
          })}
        </div>

        {colors.length ? (
          <div className="pickerSelectionChips">
            {colors.map((color) => (
              <span key={color} className="pickerSelectionChip">
                <span
                  className="pickerSelectionChipSwatch"
                  style={{ background: colorToCss(color) }}
                  aria-hidden="true"
                />
                <span>{optionLabel(color)}</span>
                <button
                  type="button"
                  className="pickerSelectionRemove"
                  onClick={() => removeColor(color)}
                  aria-label={`Remove ${color}`}
                >
                  x
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <div className="pickerCustomRow">
          <input
            className="wardrobeInput"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addColor(draft);
              }
            }}
            placeholder="Custom color"
            aria-label="Add a custom color"
          />
          <button
            type="button"
            className="btnSecondary pickerCustomAddBtn"
            onClick={() => addColor(draft)}
            disabled={!isValidCustomColor(draft)}
          >
            Add
          </button>
        </div>
      </div>
    </details>
  );
}

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

export {
  CATEGORIES,
  FIT_TAG_OPTIONS,
  ColorPickerField,
  CompactMultiSelectField,
  ColorPickerField as ColorChipInput,
  CompactMultiSelectField as MultiSelectChipField,
};

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
  tagSuggestionStatus = "idle",
  tagSuggestionMessage = "",
  tagSuggestions = null,
  error,
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const clothingTypeOptions = clothingTypeOptionsForCategory(category);

  const handleCategoryChange = useCallback((val) => {
    onCategoryChange(val);
    if (val === "One-Piece") onIsOnePieceChange(true);
    else if (category === "One-Piece") onIsOnePieceChange(false);
  }, [onCategoryChange, onIsOnePieceChange, category]);

  useEffect(() => {
    if (tagSuggestionStatus !== "idle" || tagSuggestions) {
      setShowAdvanced(true);
    }
  }, [tagSuggestionStatus, tagSuggestions]);

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
          <select className="wardrobeInput wardrobeSelect" value={category} onChange={(e) => handleCategoryChange(e.target.value)}>
            {CATEGORIES.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          {isClassifying && <span className="classifyingHint">Detecting...</span>}
        </div>
        <span className="wardrobeFieldHelp">Choose the main outfit role this item plays.</span>
      </label>

      <label className="wardrobeLabel">
        Clothing type
        <select className="wardrobeInput wardrobeSelect" value={clothingType} onChange={(e) => onClothingTypeChange(e.target.value)}>
          <option value="">Generic {category.slice(0, -1)}</option>
          {clothingTypeOptions.map((option) => (
            <option key={option} value={option}>{optionLabel(option)}</option>
          ))}
        </select>
        <span className="wardrobeFieldHelp">Use a specific type like hoodie, blazer, tee, or jeans when it fits.</span>
      </label>

      <label className="wardrobeLabel">
        Color(s)
        <ColorPickerField value={color} onChange={onColorChange} />
        <span className="wardrobeFieldHelp">Choose one or more visible colors so recommendations can coordinate better.</span>
      </label>

      <SuggestedTagsPanel
        status={tagSuggestionStatus}
        message={tagSuggestionMessage}
        suggestions={tagSuggestions}
      />

      <div className="wardrobeAdvancedCard">
        <button
          type="button"
          className={showAdvanced ? "wardrobeAdvancedToggle active" : "wardrobeAdvancedToggle"}
          onClick={() => setShowAdvanced((prev) => !prev)}
          aria-expanded={showAdvanced}
        >
          <span>{showAdvanced ? "Hide advanced details" : "Add advanced details"}</span>
          <span className={showAdvanced ? "wardrobeAdvancedChevron open" : "wardrobeAdvancedChevron"}>v</span>
        </button>

        <div className="wardrobeAdvancedHint">
          {tagSuggestionStatus !== "idle"
            ? "Suggested tags are ready to review here, and you can still change anything before saving."
            : "Optional extras for better recommendations like fit, layering, seasons, and style."}
        </div>

        {showAdvanced ? (
          <div className="wardrobeAdvancedFields">
            <label className="wardrobeLabel">
              Fit (optional)
              <select className="wardrobeInput" value={fitTag} onChange={(e) => onFitTagChange(e.target.value)}>
                {FIT_TAG_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
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
              <CompactMultiSelectField
                options={STYLE_TAG_OPTIONS}
                value={styleTags}
                onChange={onStyleTagsChange}
                placeholder="Choose styles"
                helperLabel="Pick one or more styles"
              />
              <span className="wardrobeFieldHelp">Style tags help recommendations stay casual, formal, athletic, and more.</span>
            </label>

            <label className="wardrobeLabel">
              Occasion tags
              <CompactMultiSelectField
                options={OCCASION_TAG_OPTIONS}
                value={occasionTags}
                onChange={onOccasionTagsChange}
                placeholder="Choose occasions"
                helperLabel="Pick one or more occasions"
              />
              <span className="wardrobeFieldHelp">Occasion tags help FitGPT match the outfit to work, social, athletic, and similar contexts.</span>
            </label>

            <label className="wardrobeLabel">
              Season tags
              <CompactMultiSelectField
                options={SEASON_TAG_OPTIONS}
                value={seasonTags}
                onChange={onSeasonTagsChange}
                placeholder="Choose seasons"
                helperLabel="Pick one or more seasons"
              />
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
