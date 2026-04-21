import React, { useEffect, useRef } from "react";
import {
  CATEGORIES as ITEM_CATEGORIES,
  FIT_TAG_OPTIONS,
  ColorPickerField,
  CompactMultiSelectField,
} from "./ItemFormFields";
import {
  LAYER_TYPE_OPTIONS,
  STYLE_TAG_OPTIONS,
  OCCASION_TAG_OPTIONS,
  SEASON_TAG_OPTIONS,
  clothingTypeOptionsForCategory,
  optionLabel,
} from "../utils/wardrobeOptions";
import SuggestedTagsPanel from "./SuggestedTagsPanel";

const BULK_UPLOAD_TITLE_ID = "bulk-upload-title";

function BulkUploadModal({ items, onUpdateItem, onRemoveItem, onCancel, onSave, isSaving, error }) {
  const lastFocusedRef = useRef(null);
  useEffect(() => {
    lastFocusedRef.current = document.activeElement;
    return () => {
      const target = lastFocusedRef.current;
      if (target && typeof target.focus === "function") {
        target.focus();
      }
    };
  }, []);

  return (
    <div className="modalOverlay" role="dialog" aria-modal="true" aria-labelledby={BULK_UPLOAD_TITLE_ID}>
      <div className="modalCard bulkUploadModalCard bulkUploadModalColumn" style={{ maxHeight: "85vh", width: "min(780px, 96vw)" }}>
        <div className="bulkUploadScrollArea">
          <div id={BULK_UPLOAD_TITLE_ID} className="modalTitle">Add {items.length} item{items.length > 1 ? "s" : ""}</div>

          <div style={{ display: "grid", gap: 14, marginTop: 12 }}>
          {items.map((entry) => {
            const clothingTypes = clothingTypeOptionsForCategory(entry.category);
            return (
              <div
                key={entry._key}
                className="bulkUploadItemCard"
                style={{
                  display: "grid",
                  gridTemplateColumns: "80px 1fr auto",
                  gap: 12,
                  alignItems: "start",
                }}
              >
                {entry.preview ? (
                  <img
                    src={entry.preview}
                    alt={entry.name}
                    className="bulkUploadItemPreview"
                  />
                ) : (
                  <div
                    className="bulkUploadItemPreview bulkUploadItemPreviewPlaceholder"
                    aria-hidden="true"
                  />
                )}

                <div className="bulkUploadFieldStack">
                  <SuggestedTagsPanel
                    status={entry.taggingState}
                    message={entry.taggingMessage}
                    suggestions={entry.suggestedTags}
                    compact
                  />

                  <input
                    className="wardrobeInput"
                    placeholder="Item name"
                    value={entry.name}
                    onChange={(e) => onUpdateItem(entry._key, "name", e.target.value)}
                  />

                  <div className="bulkUploadTwoColumn">
                    <div className="bulkUploadRelative">
                      <select
                        className="wardrobeInput"
                        value={entry.category}
                        onChange={(e) => onUpdateItem(entry._key, "category", e.target.value)}
                        style={{ width: "100%" }}
                      >
                        {ITEM_CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      {entry.classifying && <span className="classifyingHint">Detecting...</span>}
                    </div>

                    <select
                      className="wardrobeInput"
                      value={entry.clothingType || ""}
                      onChange={(e) => onUpdateItem(entry._key, "clothingType", e.target.value)}
                    >
                      <option value="">Generic type</option>
                      {clothingTypes.map((option) => (
                        <option key={option} value={option}>{optionLabel(option)}</option>
                      ))}
                    </select>
                  </div>

                  <ColorPickerField value={entry.color} onChange={(v) => onUpdateItem(entry._key, "color", v)} />

                  <div className="bulkUploadTwoColumn">
                    <select
                      className="wardrobeInput"
                      value={entry.fitTag}
                      onChange={(e) => onUpdateItem(entry._key, "fitTag", e.target.value)}
                    >
                      {FIT_TAG_OPTIONS.map((x) => (
                        <option key={x.value} value={x.value}>{x.label}</option>
                      ))}
                    </select>

                    <select
                      className="wardrobeInput"
                      value={entry.layerType || ""}
                      onChange={(e) => onUpdateItem(entry._key, "layerType", e.target.value)}
                    >
                      {LAYER_TYPE_OPTIONS.map((option) => (
                        <option key={option.value || "blank"} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="bulkUploadSetRow">
                    <input
                      className="wardrobeInput"
                      placeholder="Matching set ID"
                      value={entry.setId || ""}
                      onChange={(e) => onUpdateItem(entry._key, "setId", e.target.value)}
                    />
                    <label className="bulkUploadCheckboxLabel">
                      <input
                        type="checkbox"
                        checked={!!entry.isOnePiece}
                        onChange={(e) => onUpdateItem(entry._key, "isOnePiece", e.target.checked)}
                      />
                      One-piece
                    </label>
                  </div>

                  <div className="bulkUploadPickerGrid">
                    <div>
                      <div className="wardrobeFilterHeading">Style</div>
                      <CompactMultiSelectField
                        options={STYLE_TAG_OPTIONS}
                        value={entry.styleTags || []}
                        onChange={(v) => onUpdateItem(entry._key, "styleTags", v)}
                        placeholder="Choose styles"
                        helperLabel="Pick styles"
                      />
                    </div>

                    <div>
                      <div className="wardrobeFilterHeading">Occasion</div>
                      <CompactMultiSelectField
                        options={OCCASION_TAG_OPTIONS}
                        value={entry.occasionTags || []}
                        onChange={(v) => onUpdateItem(entry._key, "occasionTags", v)}
                        placeholder="Choose occasions"
                        helperLabel="Pick occasions"
                      />
                    </div>

                    <div>
                      <div className="wardrobeFilterHeading">Season</div>
                      <CompactMultiSelectField
                        options={SEASON_TAG_OPTIONS}
                        value={entry.seasonTags || []}
                        onChange={(v) => onUpdateItem(entry._key, "seasonTags", v)}
                        placeholder="Choose seasons"
                        helperLabel="Pick seasons"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="wardrobeIconBtn danger"
                  onClick={() => onRemoveItem(entry._key)}
                  title="Remove"
                  aria-label="Remove item"
                >
                  X
                </button>
              </div>
            );
          })}
        </div>

          {error ? <div className="wardrobeFormError" style={{ marginTop: 10 }}>{error}</div> : null}
        </div>

        <div className="modalActions bulkUploadActions">
          <button type="button" className="btnSecondary" onClick={onCancel} disabled={isSaving}>
            Cancel
          </button>
          <button
            type="button"
            className="btnPrimary"
            onClick={onSave}
            disabled={isSaving || !items.length}
          >
            {isSaving ? "Saving..." : `Save ${items.length} item${items.length > 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default React.memo(BulkUploadModal);
